const request = require("supertest");
const { app, _resetTodos } = require("../server");

beforeEach(() => {
  _resetTodos();
});

describe("Health check", () => {
  it("GET /health returns status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("timestamp");
  });
});

describe("POST /api/todos", () => {
  it("creates a todo with default priority", async () => {
    const res = await request(app)
      .post("/api/todos")
      .send({ title: "Write tests" });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Write tests");
    expect(res.body.completed).toBe(false);
    expect(res.body.priority).toBe("medium");
    expect(res.body.pinned).toBe(false);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("createdAt");
  });

  it("creates a todo with specified priority", async () => {
    const res = await request(app)
      .post("/api/todos")
      .send({ title: "Urgent task", priority: "high" });

    expect(res.status).toBe(201);
    expect(res.body.priority).toBe("high");
  });

  it("rejects empty title", async () => {
    const res = await request(app)
      .post("/api/todos")
      .send({ title: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Title is required");
  });

  it("rejects missing title", async () => {
    const res = await request(app)
      .post("/api/todos")
      .send({});

    expect(res.status).toBe(400);
  });

  it("rejects title longer than 200 characters", async () => {
    const res = await request(app)
      .post("/api/todos")
      .send({ title: "a".repeat(201) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/200 characters/);
  });

  it("trims whitespace from title", async () => {
    const res = await request(app)
      .post("/api/todos")
      .send({ title: "  spaced out  " });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("spaced out");
  });

  it("defaults invalid priority to medium", async () => {
    const res = await request(app)
      .post("/api/todos")
      .send({ title: "Test", priority: "super-urgent" });

    expect(res.status).toBe(201);
    expect(res.body.priority).toBe("medium");
  });
});

describe("GET /api/todos", () => {
  beforeEach(async () => {
    await request(app).post("/api/todos").send({ title: "Alpha", priority: "low" });
    await request(app).post("/api/todos").send({ title: "Beta", priority: "high" });
    await request(app).post("/api/todos").send({ title: "Gamma", priority: "medium" });
  });

  it("returns all todos with meta info", async () => {
    const res = await request(app).get("/api/todos");
    expect(res.status).toBe(200);
    expect(res.body.todos).toHaveLength(3);
    expect(res.body.meta.total).toBe(3);
    expect(res.body.meta.active).toBe(3);
    expect(res.body.meta.completed).toBe(0);
  });

  it("filters by status=active", async () => {
    await request(app).patch("/api/todos/1").send({ completed: true });

    const res = await request(app).get("/api/todos?status=active");
    expect(res.body.todos).toHaveLength(2);
    expect(res.body.todos.every((t) => !t.completed)).toBe(true);
  });

  it("filters by status=completed", async () => {
    await request(app).patch("/api/todos/1").send({ completed: true });

    const res = await request(app).get("/api/todos?status=completed");
    expect(res.body.todos).toHaveLength(1);
    expect(res.body.todos[0].title).toBe("Alpha");
  });

  it("searches by keyword", async () => {
    const res = await request(app).get("/api/todos?search=beta");
    expect(res.body.todos).toHaveLength(1);
    expect(res.body.todos[0].title).toBe("Beta");
  });

  it("search is case-insensitive", async () => {
    const res = await request(app).get("/api/todos?search=ALPHA");
    expect(res.body.todos).toHaveLength(1);
  });

  it("sorts by title", async () => {
    const res = await request(app).get("/api/todos?sort=title");
    const titles = res.body.todos.map((t) => t.title);
    expect(titles).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("default sort is newest first", async () => {
    const res = await request(app).get("/api/todos");
    const titles = res.body.todos.map((t) => t.title);
    expect(titles).toEqual(["Gamma", "Beta", "Alpha"]);
  });

  it("pinned todos appear first when sorting by created date", async () => {
    await request(app).patch("/api/todos/1").send({ pinned: true });

    const res = await request(app).get("/api/todos");
    const titles = res.body.todos.map((t) => t.title);
    expect(titles).toEqual(["Alpha", "Gamma", "Beta"]);
  });

  it("pinned todos appear first when sorting by title", async () => {
    await request(app).patch("/api/todos/3").send({ pinned: true });

    const res = await request(app).get("/api/todos?sort=title");
    const titles = res.body.todos.map((t) => t.title);
    expect(titles).toEqual(["Gamma", "Alpha", "Beta"]);
  });
});

describe("GET /api/todos/:id", () => {
  it("returns a single todo", async () => {
    await request(app).post("/api/todos").send({ title: "Find me" });

    const res = await request(app).get("/api/todos/1");
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Find me");
  });

  it("returns 404 for non-existent id", async () => {
    const res = await request(app).get("/api/todos/999");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/todos/:id", () => {
  beforeEach(async () => {
    await request(app).post("/api/todos").send({ title: "Original" });
  });

  it("updates the title", async () => {
    const res = await request(app)
      .patch("/api/todos/1")
      .send({ title: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated");
  });

  it("toggles completed", async () => {
    const res = await request(app)
      .patch("/api/todos/1")
      .send({ completed: true });

    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
  });

  it("toggles pinned", async () => {
    const res = await request(app)
      .patch("/api/todos/1")
      .send({ pinned: true });

    expect(res.status).toBe(200);
    expect(res.body.pinned).toBe(true);

    const off = await request(app)
      .patch("/api/todos/1")
      .send({ pinned: false });

    expect(off.body.pinned).toBe(false);
  });

  it("updates priority", async () => {
    const res = await request(app)
      .patch("/api/todos/1")
      .send({ priority: "high" });

    expect(res.status).toBe(200);
    expect(res.body.priority).toBe("high");
  });

  it("rejects invalid priority", async () => {
    const res = await request(app)
      .patch("/api/todos/1")
      .send({ priority: "critical" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/priority/i);
  });

  it("rejects empty title", async () => {
    const res = await request(app)
      .patch("/api/todos/1")
      .send({ title: "   " });

    expect(res.status).toBe(400);
  });

  it("rejects title over 200 chars", async () => {
    const res = await request(app)
      .patch("/api/todos/1")
      .send({ title: "x".repeat(201) });

    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent id", async () => {
    const res = await request(app)
      .patch("/api/todos/999")
      .send({ title: "Nope" });

    expect(res.status).toBe(404);
  });

  it("updates the updatedAt timestamp", async () => {
    const before = Date.now();
    const res = await request(app)
      .patch("/api/todos/1")
      .send({ title: "Changed" });

    expect(res.body.updatedAt).toBeGreaterThanOrEqual(before);
  });
});

describe("DELETE /api/todos/:id", () => {
  beforeEach(async () => {
    await request(app).post("/api/todos").send({ title: "Delete me" });
  });

  it("deletes a todo", async () => {
    const res = await request(app).delete("/api/todos/1");
    expect(res.status).toBe(204);

    const listRes = await request(app).get("/api/todos");
    expect(listRes.body.todos).toHaveLength(0);
  });

  it("returns 404 for non-existent id", async () => {
    const res = await request(app).delete("/api/todos/999");
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/todos?completed=true", () => {
  it("clears only completed todos", async () => {
    await request(app).post("/api/todos").send({ title: "Keep" });
    await request(app).post("/api/todos").send({ title: "Remove" });
    await request(app).patch("/api/todos/2").send({ completed: true });

    const res = await request(app).delete("/api/todos?completed=true");
    expect(res.status).toBe(200);

    const listRes = await request(app).get("/api/todos");
    expect(listRes.body.todos).toHaveLength(1);
    expect(listRes.body.todos[0].title).toBe("Keep");
  });

  it("rejects delete without completed=true param", async () => {
    const res = await request(app).delete("/api/todos");
    expect(res.status).toBe(400);
  });
});

describe("GET / (HTML page)", () => {
  it("serves the frontend", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
  });
});
