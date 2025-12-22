// Password Reset Script
// Run: node app/scripts/reset-password.js vj@atomicwork.com newpassword123

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function resetPassword(email, newPassword) {
    try {
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 12)

        // Update user
        const user = await prisma.user.update({
            where: { email: email },
            data: { password: hashedPassword }
        })

        console.log(`✅ Password reset for ${email}`)
        console.log(`New password: ${newPassword}`)
        return user
    } catch (error) {
        console.error('Error resetting password:', error)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

// Get args
const email = process.argv[2] || 'vj@atomicwork.com'
const newPassword = process.argv[3] || 'atomicwork123'

resetPassword(email, newPassword)
