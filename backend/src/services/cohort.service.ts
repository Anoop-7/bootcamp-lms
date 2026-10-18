import { CohortRepository } from "../repositories/cohort.repository.js";
import prisma from "../config/db.js";
import crypto from "crypto";

const cohortRepository = new CohortRepository();

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

// Student filtering helper
function filterCurriculumForStudent(folders: any[]) {
  return folders.map((folder) => ({
    ...folder,
    contents: (folder.contents || []).filter((content: any) => {
      const isVideo = content.type === "RECORDING" || content.type === "OFFLINE_VIDEO";
      if (!isVideo) return true;
      return content.videoAsset?.status === "READY";
    }),
  }));
}

export class CohortService {
  async getPublicCohorts() {
    return cohortRepository.findAllPublic();
  }

  async getCohortDetails(idOrSlug: string, userId?: string, userRole?: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    const baseCohort = await prisma.cohort.findFirst({
      where: isUuid ? { id: idOrSlug } : { slug: idOrSlug },
      select: { id: true, instructorId: true },
    });

    if (!baseCohort) {
      throw new Error("COHORT_NOT_FOUND");
    }

    const isOwner = Boolean(userId && baseCohort.instructorId === userId);
    const isAdmin = userRole === "ADMIN";
    const forStudent = !isOwner && !isAdmin;

    const cohort = isUuid
      ? await cohortRepository.findById(baseCohort.id, forStudent)
      : await cohortRepository.findBySlug(idOrSlug, forStudent);

    if (!cohort) {
      throw new Error("COHORT_NOT_FOUND");
    }

    let isEnrolled = false;
    if (userId && !isOwner && !isAdmin) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_cohortId: {
            userId,
            cohortId: cohort.id,
          },
        },
      });
      isEnrolled = !!enrollment;
    }

    const hasAccess = isOwner || isAdmin || isEnrolled;

    if (!hasAccess) {
      return {
        ...cohort,
        discordUrl: null,
        currentLiveUrl: null,
        folders: cohort.folders.map((f: any) => ({
          ...f,
          contents: (f.contents || []).map((c: any) => ({
            id: c.id,
            title: c.title,
            type: c.type,
            durationSec: c.durationSec,
            order: c.order,
            videoUrl: null,
            resourceDoc: null,
          })),
        })),
        isEnrolled: false,
        isOwner: false,
      };
    }

    const finalFolders = forStudent ? filterCurriculumForStudent(cohort.folders) : cohort.folders;

    return {
      ...cohort,
      folders: finalFolders,
      isEnrolled: isEnrolled || isOwner || isAdmin,
      isOwner,
    };
  }

  async getCohortCurriculum(cohortId: string, userId: string, userRole?: string) {
    const baseCohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      select: { id: true, instructorId: true },
    });

    if (!baseCohort) {
      throw new Error("COHORT_NOT_FOUND");
    }

    const isOwner = baseCohort.instructorId === userId;
    const isAdmin = userRole === "ADMIN";
    const forStudent = !isOwner && !isAdmin;

    let isEnrolled = false;
    if (forStudent) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_cohortId: {
            userId,
            cohortId,
          },
        },
      });
      isEnrolled = !!enrollment;
    }

    if (!isOwner && !isAdmin && !isEnrolled) {
      throw new Error("FORBIDDEN_NOT_ENROLLED");
    }

    const cohort = await cohortRepository.findById(cohortId, forStudent);
    if (!cohort) return null;

    if (forStudent) {
      return {
        ...cohort,
        folders: filterCurriculumForStudent(cohort.folders),
      };
    }

    return cohort;
  }

  async enrollUserInCohort(cohortId: string, userId: string) {
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!cohort) {
      throw new Error("COHORT_NOT_FOUND");
    }

    if (cohort.instructorId === userId) {
      return { message: "Owner already has full access", cohortId };
    }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_cohortId: {
          userId,
          cohortId,
        },
      },
    });

    if (existingEnrollment) {
      return existingEnrollment;
    }

    return prisma.enrollment.create({
      data: {
        userId,
        cohortId,
      },
    });
  }

  async createCohort(data: {
    title: string;
    description: string;
    thumbnail?: string;
    price?: number;
    originalPrice?: number;
    validity?: string;
    deliveryType?: "LIVE" | "RECORDED" | "HYBRID";
    startDate?: string;
    endDate?: string;
    discordUrl?: string;
    instructorId: string;
  }) {
    const existingInstructorCohort = await prisma.cohort.findFirst({
      where: {
        instructorId: data.instructorId,
        title: {
          equals: data.title.trim(),
          mode: "insensitive",
        },
      },
    });

    if (existingInstructorCohort) {
      throw new Error("DUPLICATE_TITLE_SAME_INSTRUCTOR");
    }

    const baseSlug = slugify(data.title) || "cohort";
    let finalSlug = baseSlug;

    const slugCollision = await prisma.cohort.findUnique({
      where: { slug: finalSlug },
    });

    if (slugCollision) {
      const shortSuffix = crypto.randomBytes(3).toString("hex");
      finalSlug = `${baseSlug}-${shortSuffix}`;
    }

    return prisma.cohort.create({
      data: {
        title: data.title.trim(),
        slug: finalSlug,
        description: data.description.trim(),
        thumbnail: data.thumbnail?.trim() || null,
        price: data.price !== undefined ? Number(data.price) : 0,
        originalPrice: data.originalPrice ? Number(data.originalPrice) : null,
        validity: data.validity || "3 years from date of purchase",
        deliveryType: data.deliveryType || "LIVE",
        status: "UPCOMING_LIVE",
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        discordUrl: data.discordUrl?.trim() || null,
        isLiveActive: false,
        instructorId: data.instructorId,
      },
    });
  }

  async updateCohort(cohortId: string, data: any) {
    return prisma.cohort.update({
      where: { id: cohortId },
      data: {
        ...data,
        price: data.price !== undefined ? Number(data.price) : undefined,
        originalPrice: data.originalPrice !== undefined ? Number(data.originalPrice) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });
  }

  async deleteCohort(cohortId: string, instructorId: string, role?: string) {
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      include: {
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!cohort) {
      throw new Error("COHORT_NOT_FOUND");
    }

    if (role !== "ADMIN" && cohort.instructorId !== instructorId) {
      throw new Error("FORBIDDEN_DELETE");
    }

    if (cohort._count.enrollments > 0) {
      throw new Error("CANNOT_DELETE_ACTIVE_ENROLLMENTS");
    }

    return prisma.$transaction(async (tx) => {
      const folders = await tx.folder.findMany({
        where: { cohortId },
        select: { id: true },
      });
      const folderIds = folders.map((f) => f.id);

      if (folderIds.length > 0) {
        await tx.content.deleteMany({
          where: { folderId: { in: folderIds } },
        });
      }

      await tx.folder.deleteMany({
        where: { cohortId },
      });

      await tx.liveAttendance.deleteMany({
        where: { cohortId },
      });

      return tx.cohort.delete({
        where: { id: cohortId },
      });
    });
  }

  async startLiveSession(cohortId: string, zoomUrl: string) {
    return cohortRepository.updateLiveStatus(cohortId, true, zoomUrl);
  }

  async endLiveSession(cohortId: string) {
    return cohortRepository.updateLiveStatus(cohortId, false, null);
  }

  async joinLiveSession(cohortId: string, userId: string) {
    const cohort = await cohortRepository.findById(cohortId);
    if (!cohort || !cohort.isLiveActive || !cohort.currentLiveUrl) {
      throw new Error("NO_ACTIVE_LIVE_SESSION");
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_cohortId: { userId, cohortId } },
    });
    if (!enrollment) throw new Error("NOT_ENROLLED");

    await cohortRepository.logLiveAttendance(userId, cohortId);
    return cohort.currentLiveUrl;
  }
}