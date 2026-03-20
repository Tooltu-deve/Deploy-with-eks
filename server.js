const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

let todos = [];
let nextId = 1;

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

// GET /api/todos?status=completed|active&search=keyword&sort=created|title
app.get("/api/todos", (req, res) => {
  let result = [...todos];

  if (req.query.status === "completed") {
    result = result.filter((t) => t.completed);
  } else if (req.query.status === "active") {
    result = result.filter((t) => !t.completed);
  }

  if (req.query.search) {
    const keyword = req.query.search.toLowerCase();
    result = result.filter((t) => t.title.toLowerCase().includes(keyword));
  }

  if (req.query.sort === "title") {
    result.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    result.sort((a, b) => b.createdAt - a.createdAt);
  }

  res.json({
    todos: result,
    meta: {
      total: todos.length,
      active: todos.filter((t) => !t.completed).length,
      completed: todos.filter((t) => t.completed).length,
      showing: result.length,
    },
  });
});

app.get("/api/todos/:id", (req, res) => {
  const todo = todos.find((t) => t.id === parseInt(req.params.id));
  if (!todo) return res.status(404).json({ error: "Todo not found" });
  res.json(todo);
});

app.post("/api/todos", (req, res) => {
  const { title, priority } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }
  if (title.trim().length > 200) {
    return res.status(400).json({ error: "Title must be 200 characters or less" });
  }

  const validPriorities = ["low", "medium", "high"];
  const todoPriority = validPriorities.includes(priority) ? priority : "medium";

  const todo = {
    id: nextId++,
    title: title.trim(),
    completed: false,
    priority: todoPriority,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  todos.push(todo);
  res.status(201).json(todo);
});

app.patch("/api/todos/:id", (req, res) => {
  const todo = todos.find((t) => t.id === parseInt(req.params.id));
  if (!todo) return res.status(404).json({ error: "Todo not found" });

  if (req.body.title !== undefined) {
    if (!req.body.title.trim()) {
      return res.status(400).json({ error: "Title cannot be empty" });
    }
    if (req.body.title.trim().length > 200) {
      return res.status(400).json({ error: "Title must be 200 characters or less" });
    }
    todo.title = req.body.title.trim();
  }
  if (req.body.completed !== undefined) todo.completed = Boolean(req.body.completed);
  if (req.body.priority !== undefined) {
    const validPriorities = ["low", "medium", "high"];
    if (!validPriorities.includes(req.body.priority)) {
      return res.status(400).json({ error: "Priority must be low, medium, or high" });
    }
    todo.priority = req.body.priority;
  }

  todo.updatedAt = Date.now();
  res.json(todo);
});

app.delete("/api/todos/:id", (req, res) => {
  const index = todos.findIndex((t) => t.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: "Todo not found" });

  todos.splice(index, 1);
  res.status(204).end();
});

app.delete("/api/todos", (req, res) => {
  if (req.query.completed === "true") {
    todos = todos.filter((t) => !t.completed);
    return res.json({ message: "Completed todos cleared" });
  }
  return res.status(400).json({ error: "Use ?completed=true to clear completed todos" });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || "1.0.0",
  });
});

function startServer() {
  return app.listen(PORT, () => {
    console.log(`Todo app running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, _resetTodos: () => { todos = []; nextId = 1; } };
