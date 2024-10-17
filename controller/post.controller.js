const Post = require("../model/post.model");
const User = require("../model/user.model");
const path = require('path');

exports.createPost = async (req, res) => {
    const { content, visibility, tags } = req.body;
    let mediaType = '';

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found!" });
        }

        if (req.files && req.files.media) {
            const uploadedFile = req.files.media;
            const fileSizeInMB = uploadedFile.size / (1024 * 1024); // Convert bytes to MB

            // Determine media type based on MIME type
            if (/jpeg|jpg|png/.test(uploadedFile.mimetype)) {
                mediaType = 'image';
                if (fileSizeInMB > 10) {
                    return res.status(400).json({ success: false, message: 'Image size exceeds 10 MB' });
                }
            } else if (/mp4/.test(uploadedFile.mimetype)) {
                mediaType = 'reel';
                if (fileSizeInMB > 50) {
                    return res.status(400).json({ success: false, message: 'Video size exceeds 50 MB' });
                }
            } else {
                return res.status(400).json({ success: false, message: 'Invalid media format. Only jpeg, jpg, png, and mp4 are allowed.' });
            }

            // Create the file name and path based on media type
            const newFileName = `${Date.now()}_${uploadedFile.name}`;
            const mediaPath = path.join(__dirname, `../profile/user-post-media/${mediaType === 'image' ? 'user-image' : 'user-reel'}/${newFileName}`);

            // Move the uploaded file to the new path
            await uploadedFile.mv(mediaPath);

            // Update the media URL
            const mediaUrl = `${req.protocol}://${req.get('host')}/profile/user-post-media/${mediaType === 'image' ? 'user-image' : 'user-reel'}/${newFileName}`;

            // Update the post visibility

            // Create a new post
            const newPost = await Post.create({
                user: user._id,
                content,
                media: mediaUrl,
                mediaType,
                visibility,
                tags
            });

            user.post.push(newPost._id);
            await user.save();

            res.status(201).json({
                success: true,
                message: "Post created successfully",
                data: newPost
            });
        } else {
            return res.status(400).json({ success: false, message: 'No media file uploaded.' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
