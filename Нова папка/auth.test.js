const request = require('supertest');
const app = require('../src/app'); // ������ ��������, ��� listen
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Authentication API', () => {
    const testEmail = 'test@example.com';
    const testPassword = 'testpassword123';
    let testUser;

    // ������� ��������� ����������� ����� �������
    beforeAll(async () => {
        await prisma.user.deleteMany({
            where: { email: testEmail }
        });
    });

    // ������� ��������� ����������� ���� �����
    afterAll(async () => {
        await prisma.user.deleteMany({
            where: { email: testEmail }
        });
        await prisma.$disconnect();
    });

    // --- ����� ��� ��������� ---
    describe('POST /api/auth/register', () => {
        it('������� ������������ ������ �����������', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: testEmail,
                    password: testPassword,
                    name: 'Test User'
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.email).toBe(testEmail);
            expect(response.body).toHaveProperty('tokens');

            testUser = response.body.user;
        });

        it('�� ������� ������������ ����������� � �������� email', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: testEmail,
                    password: testPassword,
                    name: 'Test User 2'
                });

            expect(response.status).toBe(409);
        });

        it('�� ������� ������������ ����������� � �������� �������', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'shortpass@example.com',
                    password: '123',
                    name: 'Short Pass'
                });

            expect(response.status).toBe(400);
        });
    });

    // --- ����� ��� ����� ---
    describe('POST /api/auth/login', () => {
        it('������� ����� � ����������� credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testEmail,
                    password: testPassword
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('tokens');
            expect(response.body.tokens).toHaveProperty('accessToken');
            expect(response.body.tokens).toHaveProperty('refreshToken');
        });

        it('�� ������� ����� � ������� �������', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testEmail,
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(401);
        });
    });
});
