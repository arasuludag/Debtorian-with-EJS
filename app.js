require('dotenv').config();
const express = require('express')
const mongoose = require('mongoose');
const bodyParser = require('body-parser')
const session = require('express-session')
const passport = require("passport")
const passportLocalMongoose = require("passport-local-mongoose")
const app = express()
const port = 3000

app.set('view engine', 'ejs');

//Public folder usage and bodyParser.
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// MongoDB Database stuff.
mongoose.connect('mongodb://localhost:27017/MoneyDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.set('useCreateIndex', true);

const transactionSchema = new mongoose.Schema({
  who: String,
  amount: Number,
  info: String,
  budget: String,
  crossedOut: Boolean
})

const budgetSchema = new mongoose.Schema({
  name: String,
  users: Array
});

//Create User Model
const userSchema = new mongoose.Schema({
  name: String,
  username: String,
  password: String,
  budgets: Array
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userSchema);
const Budget = mongoose.model("Budget", budgetSchema);
const Transaction = mongoose.model("Transaction", transactionSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

app.get('/', (req, res) => {
  res.render("home");
})

app.get('/select', (req, res) => {
  if (req.isAuthenticated()) {

    User.findById(req.user.id, function(err, foundUser) {
      if (err) console.log(err);
      else {
        Budget.find({
          _id: {
            $in: foundUser.budgets
          }
        }, function(err, foundBudget) {
          if (err) console.log(err);
          else res.render("select", {
            createdBudgets: foundBudget
          });
        });

      }
    });

  } else {
    res.redirect("/login");
  }
});

var budgetId;
app.post('/select', (req, res) => {

  User.findById(req.user.id, function(err, foundUser) {
    if (!err && foundUser) {

      var actionName = req.body.SubmitBudget;
      budgetId = req.body.budgetButton;

      if (actionName === "addNewBudget") {

        Budget.create({
          name: req.body.budgetName
        }, function(err, budget) {
          if (err) console.log(err);
          else {
            budget.users.push(req.user.id);
            foundUser.budgets.push(budget._id);
            foundUser.save();
            budget.save();
            res.redirect("/select");
          }
        });

      } else if (actionName === "addExistingBudget") {

        Budget.findById(req.body.budgetCode, function(err, foundBudget) {
          if (err) {
            console.log(err);
            res.render("nope");
          } else {
            console.log(foundBudget);
            foundBudget.users.push(req.user.id);
            foundUser.budgets.push(foundBudget._id);
            foundUser.save();
            foundBudget.save();
            res.redirect("/select");
          }

        });

      } else res.redirect("/money-page");
    } else console.log(err);
  })

});

app.get('/money-page', (req, res) => {
  if (req.isAuthenticated()) {

    User.findById(req.user.id, function(err, foundUser) {
      if (!err && foundUser) {

        console.log(budgetId);
        Budget.findById(budgetId, function(err, foundBudget) {
          if (err) console.log(err);
          else {

            Transaction.find({
              budget: foundBudget._id
            }, function(err, foundTrans) {
              if (err) console.log(err);
              else {

                var uniqueUsers = foundTrans.map(user => user.who).filter((value, index, self) => self.indexOf(value) === index)
                console.log(uniqueUsers);

                console.log("foundBudget._id " + foundBudget.id);

                Transaction.find({
                  budget: foundBudget.id,
                  who: {
                    $in: uniqueUsers
                  }
                }, function(err, amountsInTrans) {
                  if (err) console.log(err);

                  var userSpendingsTotal = [];
                  var usersTotalSpending;
                  var highestSummedAmount = 0;
                  var higestSummedPerson;

                  uniqueUsers.forEach((users, i) => {
                    userSpendingsTotal[i] = 0;

                    amountsInTrans.forEach(function(amount, j) {
                      if(amount.who === users && amount.crossedOut == false) {
                      userSpendingsTotal[i] += amount.amount;
                      console.log("userSpendingsTotal[i] " + userSpendingsTotal[i]); }

                    });


                    if (foundUser.name === users) {
                      usersTotalSpending = userSpendingsTotal[i];
                      console.log(usersTotalSpending);
                    }

                    if (highestSummedAmount < userSpendingsTotal[i]) {
                      highestSummedAmount = userSpendingsTotal[i];
                      higestSummedPerson = users;
                    }

                  });


                  for (var i = 0; i < uniqueUsers.length; i++) {

                    if (uniqueUsers[i] === foundUser.name) {
                      var userDebt = highestSummedAmount - userSpendingsTotal[i];

                      if (userDebt == 0) var isHighestPerson = true;
                      else isHighestPerson = false;
                    }
                  }


                  res.render("money-page", {
                    transes: foundTrans,
                    userName: foundUser.name,
                    house: foundBudget,
                    usersTotalSpending: usersTotalSpending,
                    isHighestPerson: isHighestPerson,
                    userDebt: userDebt,
                    higestSummedPerson: higestSummedPerson,
                    budgetId: budgetId
                  });


                });

              }
            });
          }
        });
      } else console.log(err);
    });

  } else res.redirect("/");
});

app.post('/money-page', (req, res) => {
  User.findById(req.user.id, function(err, foundUser) {
    if (!err && foundUser) {

      var actionName = req.body.Submit;
      console.log("aN  "+actionName)

      if (actionName === "Submitted") {

        Transaction.create({
            who: foundUser.name,
            amount: req.body.amount,
            info: req.body.info,
            budget: budgetId,
            crossedOut: false
          },
          function(err, trans) {
            if (err) console.log(err);
            else {
              res.redirect("/money-page");
            }

          });

      } else if (actionName === "Logout") {

        res.redirect("/logout");


      } else {

        Transaction.findOne({_id: actionName}, (err, foundTrans) => {
        if (err) console.log(err);

        foundTrans.crossedOut = !foundTrans.crossedOut;

        foundTrans.save();

        res.redirect("/money-page");
        });

      }
    } else console.log(err);
  })
});

app.get('/register', (req, res) => {
  res.render("register")
});

app.post('/register', (req, res) => {

  User.register({
    name: req.body.name,
    username: req.body.email
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/select");
      });
    }

  });
});

app.get('/login', (req, res) => {
  res.render("login")
});

app.post('/login', (req, res) => {

  const user = new User({
    name: req.body.name,
    username: req.body.email,
    password: req.body.password
  });

  req.login(user, function(err) {
    if (err) {
      console.log(err);
      res.redirect("/login");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/select");
      });
    }
  });
});

app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
