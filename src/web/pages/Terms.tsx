import { Link } from 'react-router-dom';

export default function Terms() {
    return (
        <div className="mx-auto max-w-3xl py-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                <h1 className="text-2xl font-bold text-gray-900">Terms & Conditions</h1>
                <p className="mt-1 text-xs text-gray-500">Last updated: November 2026</p>

                <div className="mt-6 space-y-6 text-sm leading-relaxed text-gray-600">
                    <section>
                        <h2 className="text-base font-semibold text-gray-900">1. Acceptance of Terms</h2>
                        <p className="mt-1.5">
                            By accessing or using GPA Calculator, you agree to these Terms & Conditions. If you do not agree, please discontinue use of the application.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-semibold text-gray-900">2. Educational Purpose & Accuracy Disclaimer</h2>
                        <p className="mt-1.5">
                            This platform is provided “as is” solely as a personal planning and estimation tool for students. While calculations follow standard COMSATS grading weights and grade-point scales, official transcripts and results published on CUOnline by the university examination department remain the sole authoritative record.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-semibold text-gray-900">3. User Accounts & Conduct</h2>
                        <ul className="mt-1.5 list-disc space-y-1.5 pl-5">
                            <li>You must register using your own valid CUI student email address.</li>
                            <li>You are responsible for maintaining the confidentiality of your account password.</li>
                            <li>You agree not to attempt automated abuse, spam OTP requests, or disrupt the service infrastructure.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-base font-semibold text-gray-900">4. Service Availability</h2>
                        <p className="mt-1.5">
                            As an independent student-maintained project, features may be updated, modified, or temporarily unavailable without prior notice. We recommend periodically exporting a JSON backup of your data from the Profile/Settings page.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-semibold text-gray-900">5. Contact</h2>
                        <p className="mt-1.5">
                            If you have questions about these terms or want to report a discrepancy in grade calculations, please submit a note on our{' '}
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