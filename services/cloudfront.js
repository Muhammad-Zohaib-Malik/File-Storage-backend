import { getSignedUrl } from "@aws-sdk/cloudfront-signer";

const privateKey = process.env.CLOUDFRONT_PRIVATE_KEY;

const keyPairId = process.env.CLOUDFRONT_KEYPAIR_ID;
const dateLessThan = new Date(Date.now() + 1000 * 60 * 60).toISOString();

const distributionName = process.env.CLOUDFRONT_DISTRIBUTION_NAME;

export const createCloudGetFrontSignedurl = ({
  key,
  download = false,
  filename,
}) => {
  const url = `${distributionName}/${key}?response-content-disposition=${encodeURIComponent(`${download ? "attachment" : "inline"};filename=${filename}`)}`;
  const signedUrl = getSignedUrl({
    url,
    keyPairId,
    privateKey,
    dateLessThan,
  });
  return signedUrl;
};
