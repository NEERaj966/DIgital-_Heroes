import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";

const uploadDir = fileURLToPath(new URL("../../public/temp/", import.meta.url));
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
  
export const upload = multer({
  storage,
});
