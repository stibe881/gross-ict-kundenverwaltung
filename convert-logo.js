const fs = require('fs');
const Jimp = require('jimp');

const path = './lib/logo-base64.ts';
const content = fs.readFileSync(path, 'utf-8');
const base64String = content.match(/data:image\/png;base64,([a-zA-Z0-9+/=]+)/)[1];

const buffer = Buffer.from(base64String, 'base64');

Jimp.read(buffer)
  .then(image => {
    // Fill background with white because JPEG doesn't support transparency
    const newImage = new Jimp(image.bitmap.width, image.bitmap.height, 0xFFFFFFFF);
    newImage.composite(image, 0, 0);

    newImage.getBase64(Jimp.MIME_JPEG, (err, res) => {
      if (err) throw err;
      const newContent = content.replace(/data:image\/png;base64,[a-zA-Z0-9+/=]+/, res);
      fs.writeFileSync(path, newContent);
      console.log('Successfully converted logo to JPEG and updated lib/logo-base64.ts');
    });
  })
  .catch(err => {
    console.error(err);
  });
