import type { Task, CreateTask, UpdateTask } from "../entity/task.js";
import type { DrizzleDatabase } from "../../../infrastructure/db/drizzle.js";
import { tasks } from "../../../infrastructure/db/drizzle.js";
import { eq, and, desc } from "drizzle-orm";
import type { Logger } from "../../../infrastructure/logger/logger.js";

type TaskStatus = "pending" | "in_progress" | "completed";
type TaskPriority = "low" | "medium" | "high";
type UpdateTaskData = {
  updated_at: Date;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: Date | null;
  completed_at?: Date;
};

export interface ITaskRepository {
  create(task: CreateTask): Promise<Task>;
  getByID(id: string): Promise<Task | null>;
  listByUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ tasks: Task[]; total: number }>;
  update(id: string, userId: string, task: UpdateTask): Promise<Task | null>;
  delete(id: string, userId: string): Promise<void>;
}

export class TaskRepository implements ITaskRepository {
  constructor(
    private db: DrizzleDatabase,
    private logger: Logger,
  ) {}

  async create(task: CreateTask): Promise<Task> {
    try {
      const [newTask] = await this.db.db
        .insert(tasks)
        .values({
          user_id: task.userId,
          title: task.title,
          description: task.description ?? null,
          status: task.status ?? "pending",
          priority: task.priority ?? "medium",
          due_date: task.dueDate ?? null,
        })
        .returning();

      return {
        id: newTask.id,
        userId: newTask.user_id,
        title: newTask.title,
        description: newTask.description ?? undefined,
        status: newTask.status as TaskStatus,
        priority: newTask.priority as TaskPriority,
        dueDate: newTask.due_date ?? undefined,
        completedAt: newTask.completed_at ?? undefined,
        createdAt: newTask.created_at,
        updatedAt: newTask.updated_at,
      };
    } catch (error) {
      this.logger.error("Failed to create task", { error });
      throw error;
    }
  }

  async getByID(id: string): Promise<Task | null> {
    try {
      const task = await this.db.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);

      if (task.length === 0) {
        return null;
      }

      const t = task[0];
      return {
        id: t.id,
        userId: t.user_id,
        title: t.title,
        description: t.description ?? undefined,
        status: t.status as TaskStatus,
        priority: t.priority as TaskPriority,
        dueDate: t.due_date ?? undefined,
        completedAt: t.completed_at ?? undefined,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      };
    } catch (error) {
      this.logger.error("Failed to get task by ID", { error, id });
      throw error;
    }
  }

  async listByUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ tasks: Task[]; total: number }> {
    try {
      const taskList = await this.db.db
        .select()
        .from(tasks)
        .where(eq(tasks.user_id, userId))
        .orderBy(desc(tasks.created_at))
        .limit(limit)
        .offset(offset);

      const totalResult = await this.db.db
        .select({ count: tasks.id })
        .from(tasks)
        .where(eq(tasks.user_id, userId));
      const total = totalResult.length;

      const tasksList: Task[] = taskList.map((t) => ({
        id: t.id,
        userId: t.user_id,
        title: t.title,
        description: t.description ?? undefined,
        status: t.status as TaskStatus,
        priority: t.priority as TaskPriority,
        dueDate: t.due_date ?? undefined,
        completedAt: t.completed_at ?? undefined,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));

      return { tasks: tasksList, total };
    } catch (error) {
      this.logger.error("Failed to list tasks", { error, userId });
      throw error;
    }
  }

  async update(
    id: string,
    userId: string,
    task: UpdateTask,
  ): Promise<Task | null> {
    try {
      const updateData: UpdateTaskData = {
        updated_at: new Date(),
      };

      if (task.title !== undefined) updateData.title = task.title;
      if (task.description !== undefined)
        updateData.description = task.description;
      if (task.status !== undefined) {
        updateData.status = task.status;
        if (task.status === "completed") {
          updateData.completed_at = new Date();
        }
      }
      if (task.priority !== undefined) updateData.priority = task.priority;
      if (task.dueDate !== undefined) updateData.due_date = task.dueDate;

      const [updatedTask] = await this.db.db
        .update(tasks)
        .set(updateData)
        .where(and(eq(tasks.id, id), eq(tasks.user_id, userId)))
        .returning();

      if (!updatedTask) {
        return null;
      }

      return {
        id: updatedTask.id,
        userId: updatedTask.user_id,
        title: updatedTask.title,
        description: updatedTask.description ?? undefined,
        status: updatedTask.status as TaskStatus,
        priority: updatedTask.priority as TaskPriority,
        dueDate: updatedTask.due_date ?? undefined,
        completedAt: updatedTask.completed_at ?? undefined,
        createdAt: updatedTask.created_at,
        updatedAt: updatedTask.updated_at,
      };
    } catch (error) {
      this.logger.error("Failed to update task", { error, id, userId });
      throw error;
    }
  }

  async delete(id: string, userId: string): Promise<void> {
    try {
      await this.db.db
        .delete(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.user_id, userId)));
    } catch (error) {
      this.logger.error("Failed to delete task", { error, id, userId });
      throw error;
    }
  }
}
