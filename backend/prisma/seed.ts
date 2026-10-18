import { Role, CohortStatus, DeliveryType, ContentType, VideoStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/db";

async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Clean existing records (optional, since db is already clear)
  // await prisma.watchProgress.deleteMany();
  // await prisma.content.deleteMany();
  // await prisma.videoAsset.deleteMany();
  // await prisma.folder.deleteMany();
  // await prisma.enrollment.deleteMany();
  // await prisma.cohort.deleteMany();
  // await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash("Password123!", 10);

  // 2. Create Instructor and Admin User
  const instructor = await prisma.user.create({
    data: {
      name: "Assistant Instructor",
      email: "instructor2@bootcamp.com",
      password: hashedPassword,
      role: Role.INSTRUCTOR,
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@bootcamp.com",
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  // 3. Create Student User
  const student = await prisma.user.create({
    data: {
      name: "Test Student2",
      email: "student2@bootcamp.com",
      password: hashedPassword,
      role: Role.STUDENT,
    },
  });

  // 4. Create a Test Cohort
  const cohort = await prisma.cohort.create({
    data: {
      title: "Full Stack Web Development Bootcamp",
      slug: "full-stack-web-development-bootcamp",
      description: "Master Full stack development, scaling, and event-driven systems from first principles.",
      price: 7999,
      deliveryType: DeliveryType.LIVE,
      status: CohortStatus.ONGOING_LIVE,
      instructorId: instructor.id,
    },
  });

  // 5. Enroll the Student
  await prisma.enrollment.create({
    data: {
      userId: student.id,
      cohortId: cohort.id,
    },
  });

  // 6. Create a Curriculum Folder
  const folder = await prisma.folder.create({
    data: {
      title: "Module 1: Introduction to Full Stack Development",
      cohortId: cohort.id,
      order: 1,
    },
  });

  // 7. Create a Sample Video Asset (Simulating a ready transcoded or uploaded video)
  const videoAsset = await prisma.videoAsset.create({
    data: {
      originalKey: "videos/sample-lecture-original.mp4",
      hlsManifestKey: "hls/sample-lecture/master.m3u8",
      posterKey: "posters/sample-lecture.jpg",
      durationSec: 1840,
      status: VideoStatus.READY,
    },
  });

  // 8. Link Video Asset to Content Lecture
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

  console.log("✅ Seeding finished successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });