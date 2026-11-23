// src/utils/uploadthing.ts
import { createUploadthing, type FileRouter } from "uploadthing/express";
import { UTApi } from "uploadthing/server";

const f = createUploadthing();

export const uploadRouter: FileRouter = {
  imageUploader: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  }).onUploadComplete((data) => {
    console.log("upload completed (product)", data);
  }),

  // 🔹 Fase 7.9 — avatar de usuário (separado do productImage)
  userAvatar: f({
    image: { maxFileSize: "2MB", maxFileCount: 1 },
  }).onUploadComplete((data) => {
    console.log("upload completed (userAvatar)", data);
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;

export const utapi = new UTApi();
