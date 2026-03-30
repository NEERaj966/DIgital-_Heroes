import {v2 as cloudinary} from "cloudinary"
import fs from "fs"


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim()
});

const uploadOnCloudinary = async (localFilePath, folder = "users/avatar") => {
    try {
        if (!localFilePath) return null
        const normalizedPath = localFilePath.replace(/\\/g, "/")
        const response = await cloudinary.uploader.upload(normalizedPath, {
            resource_type: "auto",
            folder
        })
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath)
        }
        return response
    } catch (error) {
        if (localFilePath && fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath)
        }
        throw error
    }
}



export {uploadOnCloudinary}
