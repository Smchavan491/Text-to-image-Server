import userModel from "../models/userModel.js";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import razorpay from "razorpay"
import transactionModel from "../models/transactionModel.js";
import { SchemaTypeOptions } from "mongoose";
import crypto from 'crypto';

const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.json({ sucess: false, message: 'Misssing Details' })
        }
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        const userData = {
            name,
            email,
            password: hashedPassword
        }

        const newUser = new userModel(userData)
        const user = await newUser.save()

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

        res.json({ success: true, token, user: { name: user.name } })

    } catch (error) {
        console.log(error)
        res.json({ sucess: false, message: error.message })

    }
}


const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body
        const user = await userModel.findOne({ email })

        if (!user) {
            return res.json({ success: false, message: 'User Does Not Exist' })
        }
        const isMatch = await bcrypt.compare(password, user.password)

        if (isMatch) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

            res.json({ success: true, token, user: { name: user.name } })
        } else {
            return res.json({ sucess: false, message: 'Invalid Credentials' })
        }

    } catch (error) {
        console.log(error)
        res.json({ sucess: false, message: error.message })
    }
}


const userCredits = async (req, res) => {
    try {
        const { userId } = req.body

        const user = await userModel.findById(userId)
        res.json({ success: true, credits: user.creditBalance, user: { name: user.name } })
    } catch (error) {
        console.log(error.message)
        res.json({ success: false, message: error.message })
    }
}

const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const paymentRazorpay = async (req, res) => {
    try {
        const { userId, planId } = req.body

        if (!userId || !planId) {
            return res.json({ success: false, message: "Missing Details" })
        }

        const userData = await userModel.findById(userId)
        if (!userData) {
            return res.json({ success: false, message: "User not found" })
        }

        let credits, plan, amount, date

        switch (planId) {
            case 'Basic':
                plan = 'Basic'
                credits = 100
                amount = 10
                break;

            case 'Advanced':
                plan = 'Advanced'
                credits = 500
                amount = 50
                break;

            case 'Business':
                plan = 'Business'
                credits = 5000
                amount = 250
                break;

            default:
                return res.json({ success: false, message: "Plan not found" });
        }

        date = Date.now();

        // Fixed variable name from userID to userId
        const transactionData = {
            userId, plan, amount, credits, date
        }

        const newTransaction = await transactionModel.create(transactionData)

        const options = {
            amount: amount * 100, // Convert to paise
            currency: process.env.CURRENCY || 'INR',
            receipt: newTransaction._id.toString(),
        }

        // Fixed the callback to properly handle the order
        const order = await razorpayInstance.orders.create(options)

        res.json({ success: true, order })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// NEW: Payment verification endpoint
const verifyRazorpay = async (req, res) => {
    try {
        const { userId, razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body

        // Create signature for verification
        const sign = razorpay_order_id + "|" + razorpay_payment_id
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex")

        // Verify signature
        if (razorpay_signature !== expectedSign) {
            return res.json({ success: false, message: "Invalid signature" })
        }

        // Find the transaction
        const transaction = await transactionModel.findById(order_id)
        if (!transaction) {
            return res.json({ success: false, message: "Transaction not found" })
        }

        // Update transaction as paid
        await transactionModel.findByIdAndUpdate(order_id, {
            payment: true,
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            signature: razorpay_signature
        })

        // Add credits to user account
        await userModel.findByIdAndUpdate(userId, {
            $inc: { creditBalance: transaction.credits }
        })

        res.json({ success: true, message: "Payment verified successfully" })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export { registerUser, loginUser, userCredits, paymentRazorpay, verifyRazorpay }