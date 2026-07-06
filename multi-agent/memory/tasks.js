export class TaskTracker {
  constructor() {
    this.tasks = new Map();
    this.counter = 0;
  }

  createTask(taskData) {
    this.counter++;
    const id = taskData.id || `T${this.counter}`;

    const task = {
      id,
      name: taskData.name,
      description: taskData.description,
      agent: taskData.agent || "builder",
      tools: taskData.tools || [],
      dependsOn: taskData.dependsOn || [],
      status: "created",
      result: null,
      error: null,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
    };

    this.tasks.set(id, task);
    return task;
  }

  getTask(id) {
    return this.tasks.get(id);
  }

  getAllTasks() {
    return Array.from(this.tasks.values());
  }

  updateStatus(id, status, data = {}) {
    const task = this.tasks.get(id);
    if (!task) return null;

    task.status = status;

    if (status === "in_progress") {
      task.startedAt = Date.now();
    } else if (status === "done" || status === "failed") {
      task.completedAt = Date.now();
    }

    if (data.result !== undefined) task.result = data.result;
    if (data.error !== undefined) task.error = data.error;

    return task;
  }

  getReadyTasks() {
    return this.getAllTasks().filter((task) => {
      if (task.status !== "created") return false;

      return task.dependsOn.every((depId) => {
        const dep = this.tasks.get(depId);
        return dep && dep.status === "done";
      });
    });
  }

  getBlockedTasks() {
    return this.getAllTasks().filter((task) => {
      if (task.status !== "created") return false;

      return task.dependsOn.some((depId) => {
        const dep = this.tasks.get(depId);
        return !dep || dep.status !== "done";
      });
    });
  }

  getStats() {
    const tasks = this.getAllTasks();
    return {
      total: tasks.length,
      created: tasks.filter((t) => t.status === "created").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
      failed: tasks.filter((t) => t.status === "failed").length,
    };
  }

  getTimeline() {
    return this.getAllTasks()
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        agent: t.agent,
        duration: t.completedAt ? t.completedAt - t.startedAt : null,
      }));
  }
}

export const globalTracker = new TaskTracker();
