import { Router } from "express";
import multer from "multer";
import { arcaConfigController } from "../controllers/arcaConfig.controller";
import { authMiddleware, requireAnyRole } from "../middleware/auth";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const certificateUpload = upload.fields([
  { name: "cert", maxCount: 1 },
  { name: "certificate", maxCount: 1 },
  { name: "certPem", maxCount: 1 },
  { name: "key", maxCount: 1 },
  { name: "privateKey", maxCount: 1 },
  { name: "keyPem", maxCount: 1 },
]);

router.use(authMiddleware);
router.use(requireAnyRole(["ADMIN", "CONTADOR"]));

router.get("/", arcaConfigController.get);
router.get("/all", arcaConfigController.list);
router.get("/config", arcaConfigController.get);
router.put("/config", arcaConfigController.upsert);

/**
 * Flujo fácil:
 * 1) POST /arca-config/generate-csr
 * 2) GET  /arca-config/:id/download-csr
 * 3) POST /arca-config/:id/upload-cert
 */
router.post("/generate-csr", arcaConfigController.generateCsr);
router.get("/:id/download-csr", arcaConfigController.downloadCsr);
router.get("/download-csr", arcaConfigController.downloadCsr);
router.post("/:id/upload-cert", certificateUpload, arcaConfigController.uploadCertificate);
router.post("/upload-cert", certificateUpload, arcaConfigController.uploadCertificate);

// Flujo viejo compatible: subir .crt + .key manualmente.
router.post("/", certificateUpload, arcaConfigController.create);
router.post("/certificados", certificateUpload, arcaConfigController.uploadCertificates);
router.post("/certificates", certificateUpload, arcaConfigController.uploadCertificates);
router.delete("/certificados", arcaConfigController.deleteCertificates);
router.delete("/certificates", arcaConfigController.deleteCertificates);

router.patch("/:id/activate", arcaConfigController.activate);
router.patch("/activate", arcaConfigController.activate);
router.post("/:id/test", arcaConfigController.test);
router.post("/test/wsaa", arcaConfigController.testWsaa);
router.post("/test/wsfe-dummy", arcaConfigController.testWsfeDummy);

router.get("/puntos-venta", arcaConfigController.listPointsOfSale);
router.get("/points-of-sale", arcaConfigController.listPointsOfSale);
router.post("/puntos-venta", arcaConfigController.upsertPointOfSale);
router.post("/points-of-sale", arcaConfigController.upsertPointOfSale);
router.delete("/puntos-venta/:id", arcaConfigController.deletePointOfSale);
router.delete("/points-of-sale/:id", arcaConfigController.deletePointOfSale);

router.get("/remitos-cai", arcaConfigController.listRemitoCais);
router.post("/remitos-cai", arcaConfigController.upsertRemitoCai);
router.put("/remitos-cai/:id", arcaConfigController.upsertRemitoCai);
router.delete("/remitos-cai/:id", arcaConfigController.deleteRemitoCai);


router.get("/auditoria", arcaConfigController.listAuditLogs);
router.get("/audit", arcaConfigController.listAuditLogs);

router.delete("/:id", arcaConfigController.remove);

export default router;
