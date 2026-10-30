// src/routes/admin/sectorRoutes.ts
import express from "express";
import { sectorController } from "../../controllers/admin/sectorController.js";
import { authenticate, isManager, isStaff } from "../../middlewares/auth.js";

const router = express.Router();

router.use(authenticate);

// 📌 Routes for STAFF and MANAGER (read)
router.get("/sectors", isStaff, sectorController.listSectors);
router.get("/sectors/options", isStaff, sectorController.getSectorOptions);
router.get("/sectors/:id", isStaff, sectorController.getSectorById);

// 📌 Routes for MANAGER (write)
router.post("/sectors", isManager, sectorController.createSector);
router.patch("/sectors/:id", isManager, sectorController.updateSector);
router.delete("/sectors/:id", isManager, sectorController.deleteSector);

export default router;
