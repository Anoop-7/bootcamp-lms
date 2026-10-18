import prisma from "../config/db.js";
import { Content, ContentType, Folder } from "@prisma/client";

export class ContentRepository {
  async createFolder(data: { title: string; cohortId: string; order?: number }): Promise<Folder> {
    return prisma.folder.create({ data });
  }

  async findFolderById(id: string): Promise<Folder | null> {
    return prisma.folder.findUnique({ where: { id } });
  }

  async createContent(data: {
    title: string;
    type: ContentType;
    folderId: string;
    videoAssetId?: string;
    resourceDoc?: string;
    durationSec?: number;
    order?: number;
  }): Promise<Content> {
    return prisma.content.create({ data });
  }

  async findContentById(id: string) {
    return prisma.content.findUnique({
      where: { id },
      include: {
        folder: {
          select: {
            cohortId: true,
          },
        },
        videoAsset: true,
      },
    });
  }
}