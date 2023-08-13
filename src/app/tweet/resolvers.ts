import { Tweet } from "@prisma/client";
import { prismaClient } from "../../clients/db";
import { GraphqlContext } from "../../interfaces";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface CreateTweetPayload {
    content : string;
    imageURL? : string;
}
const s3Client = new S3Client({
    region: process.env.AWS_DEFAULT_REGION,
});


const queries = {
    getAllTweets: () => prismaClient.tweet.findMany({orderBy : {createdAt : "desc"}}),
    getSignedURLForTweet: async (
        parent: any,
        { imageType, imageName }: { imageType: string; imageName: string },
        ctx: GraphqlContext
      ) => {
        if (!ctx.user || !ctx.user.id) throw new Error("Unauthenticated");
        const allowedImageTypes = [
          "image/jpg",
          "image/jpeg",
          "image/png",
          "image/webp",
        ];
    
        if (!allowedImageTypes.includes(imageType))
          throw new Error("Unsupported Image Type");
    
        const putObjectCommand = new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          ContentType: imageType,
          Key: `uploads/${ctx.user.id}/tweets/${imageName}-${Date.now()}.${imageType}`,
        });
    
        const signedURL = await getSignedUrl(s3Client, putObjectCommand);
    
        return signedURL;
      },
}

const mutations = {
    createTweet: async (parent: any,{payload}:{payload :CreateTweetPayload},ctx:GraphqlContext) => {
        if(!ctx.user) {
            throw new Error("You are not authenticated");
        }
        const tweet =await prismaClient.tweet.create({
            data : {
                content : payload.content,
                imageURL: payload.imageURL,
                author : {connect: {id : ctx.user.id}}
            }
        });
        return tweet;
    }
}
const authorResolver = {
    Tweet : {
        author : (parent : Tweet) =>
            prismaClient.user.findUnique({ where : {id : parent.authorId}})
    }
}
export const resolvers = {mutations,queries, authorResolver};