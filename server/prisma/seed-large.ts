import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const TASK_COUNT = 5_000;
const COMMENTS_PER_TASK = 4;
const CHUNK_SIZE = 100;

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function cleanDatabase(): Promise<void> {
  await db.taskTag.deleteMany();
  await db.tag.deleteMany();
  await db.comment.deleteMany();
  await db.taskHistory.deleteMany();
  await db.task.deleteMany();
  await db.projectMember.deleteMany();
  await db.project.deleteMany();
  await db.passwordResetToken.deleteMany();
  await db.user.deleteMany();
}

async function main(): Promise<void> {
  await cleanDatabase();

  const ana = await db.user.create({
    data: {
      email: 'ana@test.com',
      name: 'Ana Performance',
      passwordHash: await bcrypt.hash('Password1', 10),
    },
  });
  const project = await db.project.create({
    data: {
      name: 'Carga grande',
      description: 'Dataset de 5.000 tareas y 20.000 comentarios',
      ownerId: ana.id,
    },
  });
  await db.projectMember.create({
    data: { projectId: project.id, userId: ana.id, role: 'OWNER' },
  });

  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const statuses = ['TODO', 'IN_PROGRESS', 'DONE'];
  const taskRows = Array.from({ length: TASK_COUNT }, (_, index) => ({
    projectId: project.id,
    title: `Tarea de carga ${String(index + 1).padStart(4, '0')}`,
    description: `Registro de rendimiento ${index + 1}`,
    status: statuses[index % statuses.length],
    priority: priorities[index % priorities.length],
    assigneeId: index % 3 === 0 ? ana.id : null,
  }));
  for (const batch of chunks(taskRows, CHUNK_SIZE)) {
    await db.task.createMany({ data: batch });
  }

  const tasks = await db.task.findMany({
    where: { projectId: project.id },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  const commentRows = tasks.flatMap((task, taskIndex) =>
    Array.from({ length: COMMENTS_PER_TASK }, (_, commentIndex) => ({
      taskId: task.id,
      authorId: ana.id,
      body: `Comentario ${commentIndex + 1} de la tarea ${taskIndex + 1}`,
    })),
  );
  for (const batch of chunks(commentRows, CHUNK_SIZE)) {
    await db.comment.createMany({ data: batch });
  }

  const comments = await db.comment.count();
  // eslint-disable-next-line no-console
  console.log(
    `Seed grande listo: ${tasks.length} tareas, ${comments} comentarios, proyecto ${project.id}.`,
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
