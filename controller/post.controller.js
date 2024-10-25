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
                    message: "Post created successfully",
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

                res.status(201).json({
                    success: true,
                    message: "Post created successfully"
                });
            }
        } else {
            return res.status(400).json({ success: false, message: 'No media file uploaded.' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
}

exports.getAllPosts = async (req, res) => {
    try {
        const { id } = req.body;
        const currentUserId = req.user.id;
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found!" });
        }

        const posts = await Post.find({ user: user._id });
        if (!posts) {
            return res.status(404).json({ success: false, message: "Posts not found!" });
        }
        const imagePosts = posts.map(post => ({
            ...post.toObject(), // Convert Mongoose document to plain object
            post: post.post.filter(item => item.mediaType === 'image') // Filter for image mediaType
        }))
        if (id === currentUserId) {
            // const imagePosts = posts.flatMap(post => 
            //     post.post.filter(item => item.mediaType === 'image')
            // );
            
            return res.status(200).json({
                success: true,
                data: imagePosts
            });
        }
        // If the user is private, check if the current user is a follower
        if (user.isPrivate && !user.followers.includes(currentUserId)) {
            return res.status(403).json({ success: false, message: "This user has a private account. You need to follow them to see their Posts." });
        }

        res.status(200).json({ success: true, data: imagePosts });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
}

exports.getAllReels = async (req, res) => {
    try {
        const { id } = req.body;
        const currentUserId = req.user.id;
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found!" });
        }

        const posts = await Post.find({ user: user._id });
        if (!posts) {
            return res.status(404).json({ success: false, message: "Posts not found!" });
        }
        const reelPosts = posts.map(post => ({
            ...post.toObject(), // Convert Mongoose document to plain object
            post: post.post.filter(item => item.mediaType === 'reel') // Filter for image mediaType
        }))
        if (id === currentUserId) {
            // const reelPosts = posts.flatMap(post => 
            //     post.post.filter(item => item.mediaType === 'reel')
            // );
            
            return res.status(200).json({
                success: true,
                data: reelPosts
            });
        }
        // If the user is private, check if the current user is a follower
        if (user.isPrivate && !user.followers.includes(currentUserId)) {
            return res.status(403).json({ success: false, message: "This user has a private account. You need to follow them to see their Reels." });
        }

        res.status(200).json({ success: true, data: reelPosts });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
}

exports.getPost = async (req, res) => {
    const { postId, itemId } = req.body; // Assume itemId is passed as a URL parameter
    if (!postId || !itemId) {
        return res.status(400).json({ success: false, message: 'Missing postId or itemId' });
    }

    try {
        const currentUserId = req.user.id;

        // Find the post's user
        const postUser = await Post.findById(postId).populate('user');
        if (!postUser) {
            return res.status(404).json({ success: false, message: "Post not found!" });
        }

        // Check if the post's user is private and if the current user is not a follower
        if (postUser.user.isPrivate && !postUser.user.followers.includes(currentUserId)) {
            return res.status(403).json({ success: false, message: "This user has a private account. You need to follow them to see this post." });
        }

        // Update the specific item's views count in the post array
        const result = await Post.updateOne(
            { _id: postId, 'post._id': itemId },
            { $inc: { 'post.$.views': 1 } } // Increment the views for the specific item
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: "Item not found in the post!" });
        }

        // Fetch the updated item to return
        const updatedPost = await Post.findById(postId)
        const updatedItem = updatedPost.post.find(item => item._id.toString() === itemId);

        // Return the specific item along with userId and itemId
        res.status(200).json({
            success: true,
            data: {
                userId: postUser.user._id, // Include userId
                itemId: updatedItem._id,    // Include itemId
                item: updatedItem,             // Include the updated item details
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};   // haf kam hua hai


///////// like 
exports.likePost = async (req, res) => {
    try {
        const { postId } = req.body; // Get post ID from the request body
        const userId = req.user.id; // Get the ID of the user liking/unliking the post

        // Validate input
        if (!postId) {
            return res.status(400).json({ success: false, message: "Post ID is required." });
        }

        // Find the post by ID
        const post = await Post.findOne({ "post._id": postId });
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found!" });
        }

        // Find the specific post item within the post array
        const postItem = post.post.id(postId);

        // Check if the user has already liked the post
        const isLiked = postItem.likes && postItem.likes.includes(userId);

        // If already liked, unlike the post
        if (isLiked) {
            postItem.likes = postItem.likes.filter(like => like.toString() !== userId);
            await post.save();

            return res.status(200).json({
                success: true,
                message: "Post unliked successfully",
                likesCount: postItem.likes.length // Return the updated likes count
            });
        }

        // If not liked, check visibility rules for private accounts
        if (postItem.visibility === 'private') {
            const isFollower = post.user.followers.includes(userId);
            if (!isFollower) {
                return res.status(403).json({ success: false, message: "You must follow this user to like their post." });
            }
        }

        // Add the user to the likes array
        if (!postItem.likes) {
            postItem.likes = []; // Initialize likes array if it doesn't exist
        }
        postItem.likes.push(userId);
        await post.save();

        return res.status(200).json({
            success: true,
            message: "Post liked successfully",
            likesCount: postItem.likes.length // Return the updated likes count
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};




