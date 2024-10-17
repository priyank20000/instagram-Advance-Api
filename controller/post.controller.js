const Post = require("../model/post.model");
const User = require("../model/user.model");
const path = require('path');
const sharp = require('sharp');

exports.createPost = async (req, res) => {
    const { content, visibility, tags } = req.body;
    let mediaType = '';

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found!" });
        }

        // Check if media is uploaded
        if (req.files && req.files.media) {
            const uploadedFile = req.files.media;
            const fileSizeInMB = uploadedFile.size / (1024 * 1024); // Convert bytes to MB

            // Determine media type based on MIME type
            if (/jpeg|jpg|png/.test(uploadedFile.mimetype)) {
                mediaType = 'image';
                if (fileSizeInMB > 10) {
                    return res.status(400).json({ success: false, message: 'Image size exceeds 10 MB' });
                }
                // Validate image aspect ratio
                const image = sharp(uploadedFile.data);
                const { width, height } = await image.metadata();
                if (width !== height) {
                    return res.status(400).json({ success: false, message: 'Image must be square (1:1 aspect ratio).' });
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

            // Find the existing post for the user
            let existingPost = await Post.findOne({ user: user._id });

            if (existingPost) {
                // If post exists, push the new media into the post array
                existingPost.post.push({
                    content,
                    media: mediaUrl,
                    mediaType,
                    visibility,
                    tags
                });
                await existingPost.save();
                res.status(200).json({
                    success: true,
                    message: "Post updated successfully",
                    data: existingPost
                });
            } else {
                // Create a new post if no existing post is found
                const newPost = await Post.create({
                    user: user._id,
                    post: [{
                        content,
                        media: mediaUrl,
                        mediaType,
                        visibility,
                        tags
                    }]
                });

                user.post.push(newPost._id);
                await user.save();

                res.status(201).json({
                    success: true,
                    message: "Post created successfully",
                    data: newPost
                });
            }
        } else {
            return res.status(400).json({ success: false, message: 'No media file uploaded.' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};


