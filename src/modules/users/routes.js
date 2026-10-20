const express = require("express");
const { protect, allowedTo } = require("../../middlewares/auth");
const {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
} = require("./services");

const router = express.Router();

router.use(protect, allowedTo("admin"));

router.route("/")
    .get(getAllUsers)
    .post(createUser);

router.route("/:id")
    .get(getUserById)
    .put(updateUser)
    .delete(deleteUser);

module.exports = router;
