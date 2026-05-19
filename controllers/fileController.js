import path from "path";
import Directory from "../models/directoryModel.js";
import User from "../models/userModel.js";
import File from "../models/fileModel.js";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";
import {
  createUploadSignedUrl,
  deleteS3FileFromAws,
  getS3FileMetaData,
} from "../services/s3.js";
import { createCloudGetFrontSignedurl } from "../services/cloudfront.js";
import { sendFileLink } from "../utils/nodemailer.js";

const window = new JSDOM("").window;
const purify = DOMPurify(window);

export const updateDirectoriesSize = async (parentId, deltaSize) => {
  while (parentId) {
    const dir = await Directory.findById(parentId);
    dir.size += deltaSize;
    await dir.save();
    parentId = dir.parentDirId;
  }
};

export const renameFile = async (req, res, next) => {
  const { id } = req.params;
  const file = await File.findOne({
    _id: id,
    userId: req.user._id,
  });

  let { newFilename } = req.body;
  newFilename = purify.sanitize(newFilename);

  // Check if file exists
  if (!file) {
    return res.status(404).json({ error: "File not found!" });
  }

  try {
    file.name = newFilename;
    await file.save();
    return res.status(200).json({ message: "Renamed" });
  } catch (err) {
    console.log(err);
    err.status = 500;
    next(err);
  }
};

//upload Initiate
export const uploadToAws = async (req, res, next) => {
  const parentDirId = req.body.parentDirId || req.user.rootDirId;
  const ContentType = req.body.ContentType;

  try {
    const parentDirData = await Directory.findOne({
      _id: parentDirId,
      userId: req.user._id,
    });

    // Check if parent directory exists
    if (!parentDirData) {
      return res.status(404).json({ error: "Parent directory not found!" });
    }

    const filename = req.body.name || "Untitled";
    const filesize = req.body.size;
    const extension = path.extname(filename);
    const user = await User.findById(req.user._id);
    const rootDir = await Directory.findById(req.user.rootDirId);
    const remainingSpace = user.maxStorageInBytes - rootDir.size;

    if (filesize > remainingSpace) {
      return res.status(507).json({ error: "Not Enough Storage" });
    }

    const insertedFile = await File.insertOne({
      extension,
      name: filename,
      size: filesize,
      parentDirId: parentDirData._id,
      userId: req.user._id,
      isUploading: true,
    });

    const fileId = insertedFile.id;

    const key = `${fileId}${extension}`;

    const uploadSignedUrl = await createUploadSignedUrl({
      key,
      ContentType,
    });

    res.json({ uploadSignedUrl, fileId });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// upload complete
export const uploadToAwsComplete = async (req, res, next) => {
  const file = await File.findById(req.body.fileId);
  if (!file) {
    return res.status(404).json({ error: "File not found!" });
  }
  const key = `${file._id}${file.extension}`;

  try {
    const { ContentLength } = await getS3FileMetaData({ key });

    if (file.size !== ContentLength) {
      await file.deleteOne();
      return res.status(400).json({
        error: "File size does not match",
      });
    }

    file.isUploading = false;
    await file.save();

    await updateDirectoriesSize(file.parentDirId, file.size);

    res.json({ message: "Upload complete" });
  } catch (error) {
    await file.deleteOne();
    next(error);
  }
};

export const getFileFromAws = async (req, res) => {
  const { id } = req.params;
  const fileData = await File.findOne({
    _id: id,
    userId: req.user._id,
  }).lean();
  // Check if file exists
  if (!fileData) {
    return res.status(404).json({ error: "File not found!" });
  }

  const key = `${id}${fileData.extension}`;
  if (req.query.action === "download") {
    const fileUrl = createCloudGetFrontSignedurl({
      key,
      download: true,
      filename: fileData.name,
    });
    return res.redirect(fileUrl);
  }

  const fileUrl = createCloudGetFrontSignedurl({
    key,
    filename: fileData.name,
  });

  return res.redirect(fileUrl);
};

export const deleteFileFromAws = async (req, res, next) => {
  const { id } = req.params;
  const file = await File.findOne({
    _id: id,
    userId: req.user._id,
  });

  if (!file) {
    return res.status(404).json({ error: "File not found!" });
  }
  const key = `${file._id}${file.extension}`;

  try {
    await file.deleteOne();
    await updateDirectoriesSize(file.parentDirId, -file.size);
    await deleteS3FileFromAws({ key });
    return res.status(200).json({ message: "File Deleted Successfully" });
  } catch (err) {
    next(err);
  }
};

export const shareFileViaEmail = async (req, res, next) => {
  const { fileId, email } = req.body;
  const fileData = await File.findOne({
    _id: fileId,
    userId: req.user._id,
  }).lean();

  if (!fileData) {
    return res.status(404).json({ error: "File not found!" });
  }

  const key = `${fileId}${fileData.extension}`;
  const fileUrl = createCloudGetFrontSignedurl({
    key,
    filename: fileData.name,
  });
  try {
    await sendFileLink(email, fileUrl, fileData.name);
    res.json({ success: true, message: "File shared via email!" });
  } catch (error) {
    next(error);
  }
};
