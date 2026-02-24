const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Task name is required"],
            trim: true,
        },

        description: {
            type: String,
            default: "",
        },

        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
        },

        assignee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
            default: null,
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // PRD: To Do -> In Progress -> Review -> Done
        status: {
            type: String,
            enum: ["todo", "in-progress", "review", "done"],
            default: "todo",
        },

        priority: {
            type: String,
            enum: ["none", "low", "medium", "high", "urgent"],
            default: "none",
        },

        dueDate: { type: Date },

        // Sub-tasks (PRD: expandable items under parent with independent completion)
        parentTask: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            default: null,
        },

        completedAt: { type: Date },
    },
    {
        timestamps: true,
    }
);

// Index for fast lookups
taskSchema.index({ assignee: 1, status: 1 });
taskSchema.index({ project: 1 });

const Task = mongoose.model("Task", taskSchema);

module.exports = Task;
