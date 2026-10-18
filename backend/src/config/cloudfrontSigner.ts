import { getSignedCookies } from "@aws-sdk/cloudfront-signer";
import fs from "fs";
import path from "path";

const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID || "K2CIE7YYA2M7CP";
const cloudfrontDomain = (process.env.CLOUDFRONT_DOMAIN || "https://dfc7l4xfbzxw5.cloudfront.net").replace(/\/$/, "");

// Read private key
function getPrivateKey(): string {
  const localPath = path.resolve(process.cwd(), "private_key.pem");
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath, "utf-8");
  }
  const altPath = path.resolve(process.cwd(), "src/config/private_key.pem");
  if (fs.existsSync(altPath)) {
    return fs.readFileSync(altPath, "utf-8");
  }
  throw new Error("CloudFront private_key.pem not found in project root.");
}

export function generateCloudFrontCookies(resourcePattern: string = "/*") {
  const privateKey = getPrivateKey();
  const url = `${cloudfrontDomain}${resourcePattern}`;

  // Cookie valid for 6 hours
  const dateLessThan = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

  const policy = JSON.stringify({
    Statement: [
      {
        Resource: url,
        Condition: {
          DateLessThan: {
            "AWS:EpochTime": Math.floor(new Date(dateLessThan).getTime() / 1000),
          },
        },
      },
    ],
  });

  return getSignedCookies({
    keyPairId,
    privateKey,
    policy,
  });
}