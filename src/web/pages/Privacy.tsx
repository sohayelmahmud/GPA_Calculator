import { Link } from 'react-router-dom';

export default function Privacy() {
    return (
        <div className="mx-auto max-w-3xl py-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
                <p className="mt-1 text-xs text-gray-500">Last updated: November 2026</p>

                <div className="mt-6 space-y-6 text-sm leading-relaxed text-gray-600">
                    <section>
                        <h2 className="text-base font-semibold text-gray-900">1. Overview & Independence</h2>
                        <p className="mt-1.5">
                            GPA Calculator is an independent educational tool built for students. It is not affiliated with, endorsed by, or connected to the official COMSATS University Islamabad (CUI) administration or CUOnline portal. Please do not use your official university portal password here.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-semibold text-gray-900">2. Information We Collect</h2>
                        <ul className="mt-1.5 list-disc space-y-1.5 pl-5">
                            <li>
                                <strong className="text-gray-800">Guest Mode:</strong> When using the calculator without an account, all semester, course, and marks data are stored locally in your browser (<code className="rounded bg-gray-100 px-1 py-0.5 text-xs">localStorage</code>) and are never sent to our servers.
                            </li>
                            <li>
                                <strong className="text-gray-800">Registered Accounts:</strong> When you create an account, we store your name, roll number, official student email (<code className="rounded bg-gray-100 px-1 py-0.5 text-xs">@isbstudent.comsats.edu.pk</code>), hashed password, and academic records (semesters, courses, marks, and custom grade scale) in a Cloudflare D1 database.
                            </li>
                            <li>
                                <strong className="text-gray-800">Contact Messages:</strong> If you submit the contact form, we store your name, email address, and message to respond to your inquiry or bug report.
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-base font-semibold text-gray-900">3. Security & Authentication</h2>
                        <p className="mt-1.5">
                            Passwords are never stored in plain text; they are salted and hashed using PBKDF2-SHA256 (100,000 iterations). One-time verification codes (OTPs) are hashed before storage and automatically expire after 15 minutes. Authentication sessions use HTTP-only, secure cookies.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-semibold text-gray-900">4. Third-Party Services</h2>
                        <p className="mt-1.5">
                            We use Cloudflare Workers & D1 for hosting and database storage, Brevo for delivering account verification emails, and Formspree for contact message notifications. We do not sell, rent, or share your personal or academic data with advertisers or third parties.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-semibold text-gray-900">5. Your Data Control</h2>
                        <p className="mt-1.5">
                            You can export a full JSON backup of your academic records or permanently delete your account and all associated database records at any time from your{' '}
                            <Link to="/profile" className="font-medium text-indigo-600 hover:underline">
                                Profile
                            </Link>{' '}
                            page. For any privacy questions, reach out via the{' '}
                            <Link to="/contact" className="font-medium text-indigo-600 hover:underline">
                                Contact Us
                            </Link>{' '}
                            page.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}