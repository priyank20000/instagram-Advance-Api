const app = require('express');
const router = app.Router()    
//////////////////////////////
const { createPost } = require('../controller/post.controller');
const { isAuthenticatedUser } = require('../middleware/auth');

router.post("/post", isAuthenticatedUser, createPost);

module.exports  = router;