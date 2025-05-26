const bcrypt = require('bcryptjs');

const password = 'Admin@123';

bcrypt.genSalt(10)
    .then(salt => bcrypt.hash(password, salt))
    .then(hash => {
        console.log('Hashed password:', hash);
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    }); 