require("dotenv").config();
const mongoose = require("mongoose");
require("./config/db");
const User = require("./models/User");

mongoose.connection.once("open", async () => {
    console.log("Connected to MongoDB\n");
    
    try {
        const harshwardhan = await User.findOne({ fullName: /harshwardhan/i });
        
        if (!harshwardhan) {
            console.log("❌ Harshwardhan not found");
        } else {
            console.log("✅ Found user:");
            console.log("   Full Name:", harshwardhan.fullName);
            console.log("   Email:", harshwardhan.email);
            console.log("   Status:", harshwardhan.status);
            console.log("   Role:", harshwardhan.role);
        }
        
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
});
