const app = require('express');
const router = app.Router()
//////////////////////////////
const { register, profile, login, getUser } = require('../controller/user.controller');
const { isAuthenticatedUser } = require('../middleware/auth');



////////////////////////////
router.post("/register", register);
router.post("/login", login);
router.post("/profile", isAuthenticatedUser, profile)

/////////////////////////////////
router.get("/getUser", isAuthenticatedUser, getUser )

module.exports  = router;