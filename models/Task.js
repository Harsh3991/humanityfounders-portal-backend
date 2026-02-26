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

        assignees: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }],

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
taskSchema.index({ assignees: 1, status: 1 });
taskSchema.index({ assignees: 1, parentTask: 1, dueDate: 1 }); // Accelerates "My Tasks" on Dashboard
taskSchema.index({ project: 1, parentTask: 1, priority: -1, dueDate: 1 }); // Accelerates Project page Tasks
taskSchema.index({ parentTask: 1 }); // Accelerates subtask lookups

const Task = mongoose.model("Task", taskSchema);

module.exports = Task;
