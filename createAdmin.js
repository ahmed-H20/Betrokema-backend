require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/modules/users/model');

async function createAdmin() {
    try {
        await mongoose.connect(process.env.DB_URL, { family: 4 });
        console.log('Connected to MongoDB successfully.');

        const existing = await User.findOne({
            $or: [
                { code: 'Petro-Kema' },
                { email: 'petro-kema' }
            ]
        });

        if (existing) {
            console.log('User found, updating...');
            existing.name = 'Petro-Kema';
            existing.code = 'Petro-Kema';
            existing.email = 'petro-kema';
            existing.role = 'admin';
            existing.isActive = true;
            existing.password = 'Petro123';
            await existing.save();
            console.log('Admin user updated:', existing);
        } else {
            const user = await User.create({
                name: 'Petro-Kema',
                code: 'Petro-Kema',
                email: 'petro-kema',
                password: 'Petro123',
                role: 'admin',
                isActive: true
            });
            console.log('Admin user created successfully:', user);
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

createAdmin();
