const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Project name is required"],
            trim: true,
        },

        description: {
            type: String,
            default: "",
        },

        status: {
            type: String,
            enum: ["active", "completed", "on-hold", "archived"],
            default: "active",
        },

        // Members assigned to this project
        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        deadline: { type: Date },
    },
    {
        timestamps: true,
    }
);

const Project = mongoose.model("Project", projectSchema);

module.exports = Project;
