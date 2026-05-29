import Directory from "../models/directoryModel.js";
import File from "../models/fileModel.js";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";
import { updateDirectoriesSize } from "./fileController.js";
import { deleteS3FilesFromAws } from "../services/s3.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
const window = new JSDOM("").window;
const purify = DOMPurify(window);

export const getDirectory = async (req, res, next) => {
  try {
    const user = req.user;
    const _id = req.params.id || user.rootDirId.toString();
    const directoryData = await Directory.findOne({ _id }).lean();
    if (!directoryData) {
      throw new ApiError(404, "Directory not found or you do not have access to it!");
    }

    const files = await File.find({ parentDirId: directoryData._id }).lean();
    const directories = await Directory.find({ parentDirId: _id }).lean();
    return res.status(200).json(new ApiResponse(200, {
      ...directoryData,
      files: files.map((dir) => ({ ...dir, id: dir._id })),
      directories: directories.map((dir) => ({ ...dir, id: dir._id })),
    }));
  } catch (err) {
    next(err);
  }
};

export const createDirectory = async (req, res, next) => {
  const user = req.user;

  const parentDirId = req.params.parentDirId || user.rootDirId.toString();
  let dirname = req.headers.dirname || "New Folder";
  dirname = purify.sanitize(dirname);
  try {
    const parentDir = await Directory.findOne({
      _id: parentDirId,
    }).lean();

    if (!parentDir)
      throw new ApiError(404, "Parent Directory Does not exist!");

    await Directory.insertOne({
      name: dirname,
      parentDirId,
      userId: user._id,
    });

    return res.status(201).json(new ApiResponse(201, null, "Directory Created!"));
  } catch (err) {
    if (err.code === 121) {
      next(new ApiError(400, "Invalid input, please enter valid details"));
    } else {
      next(err);
    }
  }
};

export const renameDirectory = async (req, res, next) => {
  const user = req.user;
  const { id } = req.params;
  let { newDirName } = req.body || "New Folder";
  newDirName = purify.sanitize(newDirName);
  try {
    await Directory.findOneAndUpdate(
      {
        _id: id,
        userId: user._id,
      },
      { name: newDirName }
    );
    res.status(200).json(new ApiResponse(200, null, "Directory Renamed!"));
  } catch (err) {
    next(err);
  }
};

export const deleteDirectory = async (req, res, next) => {
  const { id } = req.params;

  try {
    const directoryData = await Directory.findOne({
      _id: id,
      userId: req.user._id,
    }).lean();

    if (!directoryData) {
      throw new ApiError(404, "Directory not found!");
    }

    async function getDirectoryContents(id) {
      let files = await File.find({ parentDirId: id })
        .select("extension")
        .lean();
      let directories = await Directory.find({ parentDirId: id })
        .select("_id")
        .lean();

      for (const { _id } of directories) {
        const { files: childFiles, directories: childDirectories } =
          await getDirectoryContents(_id);

        files = [...files, ...childFiles];
        directories = [...directories, ...childDirectories];
      }

      return { files, directories };
    }

    const { files, directories } = await getDirectoryContents(id);

    const keys = files.map(({ _id, extension }) => ({
      Key: `${_id}${extension}`,
    }));

    await deleteS3FilesFromAws({ keys });

    await File.deleteMany({
      _id: { $in: files.map(({ _id }) => _id) },
    });

    await Directory.deleteMany({
      _id: { $in: [...directories.map(({ _id }) => _id), id] },
    });

    await updateDirectoriesSize(directoryData.parentDirId, -directoryData.size);
    return res.status(200).json(new ApiResponse(200, null, "Files deleted successfully"));
  } catch (err) {
    next(err);
  }
};
