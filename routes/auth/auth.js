const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');

const register = require('./register');
router.use('/register', register);

const login = require('./login');
router.use('/login', login);

const forgetPassword = require('./forgetPassword');
router.use('/forget-password', forgetPassword);

const resetPassword = require('./resetPassword');
router.use('/reset-password', resetPassword);

const getAllUsers = require('./getAllUsers');
router.use('/users', getAllUsers);

const blockUser = require('./blockUser');
router.use('/block-user', blockUser);

const unblockUser = require('./unblockUser');
router.use('/unblock-user', unblockUser);

const getUser = require('./GetUser');
router.use('/user', getUser);

const getUserById = require('./getUserById');
router.use('/v2', getUserById);

const addUser = require('./addUser');
router.use('/add', addUser);

const logout = require('./logout');
router.use('/logout', logout);
module.exports = router;
