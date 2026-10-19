import { Role, CohortStatus, DeliveryType, ContentType, VideoStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/db.js";

async function main() {
  // Guard: Never execute seed script in production
  if (process.env.NODE_ENV === "production") {
    console.error("❌ Refusing to run seed script in production environment.");
    process.exit(1);
  }

  console.log("🌱 Starting idempotent database seeding...");

  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || "Password123!";
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  // 1. Upsert Instructor User
  const instructor = await prisma.user.upsert({
    where: { email: "instructor2@bootcamp.com" },
    update: {
      role: Role.INSTRUCTOR,
      name: "Assistant Instructor",
    },
    create: {
      name: "Assistant Instructor",
      email: "instructor2@bootcamp.com",
      password: hashedPassword,
      role: Role.INSTRUCTOR,
    },
  });

  // 2. Upsert Admin User
  await prisma.user.upsert({
    where: { email: "admin@bootcamp.com" },
    update: {
      role: Role.ADMIN,
      name: "Admin User",
    },
    create: {
      name: "Admin User",
      email: "admin@bootcamp.com",
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  // 3. Upsert Student User
  const student = await prisma.user.upsert({
    where: { email: "student2@bootcamp.com" },
    update: {
      role: Role.STUDENT,
      name: "Test Student2",
    },
    create: {
      name: "Test Student2",
      email: "student2@bootcamp.com",
      password: hashedPassword,
      role: Role.STUDENT,
    },
  });

  // 4. Upsert Test Cohort
  const cohort = await prisma.cohort.upsert({
    where: { slug: "full-stack-web-development-bootcamp" },
    update: {
      title: "Full Stack Web Development Bootcamp",
      price: 7999,
      instructorId: instructor.id,
    },
    create: {
      title: "Full Stack Web Development Bootcamp",
      slug: "full-stack-web-development-bootcamp",
      description: "Master Full stack development, scaling, and event-driven systems from first principles.",
      price: 7999,
      deliveryType: DeliveryType.LIVE,
      status: CohortStatus.ONGOING_LIVE,
      instructorId: instructor.id,
    },
  });

  // 5. Ensure Student Enrollment exists
  await prisma.enrollment.upsert({
    where: {
      userId_cohortId: {
        userId: student.id,
        cohortId: cohort.id,
      },
    },
    update: {},
    create: {
      userId: student.id,
      cohortId: cohort.id,
    },
  });

  // 6. Ensure Curriculum Folder exists
  let folder = await prisma.folder.findFirst({
    where: {
      cohortId: cohort.id,
      title: "Module 1: Introduction to Full Stack Development",
    },
  });

  if (!folder) {
    folder = await prisma.folder.create({
      data: {
        title: "Module 1: Introduction to Full Stack Development",
        cohortId: cohort.id,
        order: 1,
      },
    });
  }

  // 7. Ensure Video Asset exists
  let videoAsset = await prisma.videoAsset.findFirst({
    where: { originalKey: "videos/sample-lecture-original.mp4" },
  });

  if (!videoAsset) {
    videoAsset = await prisma.videoAsset.create({
      data: {
        originalKey: "videos/sample-lecture-original.mp4",
        hlsManifestKey: "hls/sample-lecture/master.m3u8",
        posterKey: "posters/sample-lecture.jpg",
        durationSec: 1840,
        status: VideoStatus.READY,
      },
    });
  }

  // 8. Link Video Asset to Content Lecture
  const existingContent = await prisma.content.findFirst({
    where: {
      folderId: folder.id,
      title: "Introduction to Full Stack Development",
    },
  });

  if (!existingContent) {
    await prisma.content.create({
      data: {
        title: "Introduction to Full Stack Development",
        type: ContentType.RECORDING,
        folderId: folder.id,
        videoAssetId: videoAsset.id,
        durationSec: 1840,
        order: 1,
      },
    });
  }

  console.log("✅ Database seeded idempotently!");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });