export interface PresetCourse {
    code: string;
    name: string;
    credits: number;
    hasLab: boolean;
    theoryCredits: number;
    labCredits: number;
    aliases?: string[];
}

export const CUI_BCS_COURSES: PresetCourse[] = [
    // Capstone Project
    { code: 'CSC498', name: 'Final Year Project I', credits: 2, hasLab: true, theoryCredits: 0, labCredits: 2, aliases: ['fyp 1', 'fyp i'] },
    { code: 'CSC499', name: 'Final Year Project II', credits: 4, hasLab: true, theoryCredits: 0, labCredits: 4, aliases: ['fyp 2', 'fyp ii'] },

    // Application of ICT
    { code: 'CSC101', name: 'Applications of Information and Communication Technologies', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['ict', 'aict'] },

    // Arts and Humanities
    { code: 'ADA111', name: 'History and Theory of Art and Culture I', credits: 2, hasLab: false, theoryCredits: 2, labCredits: 0 },
    { code: 'ARC108', name: 'Art Appreciation', credits: 2, hasLab: false, theoryCredits: 2, labCredits: 0 },
    { code: 'ARC351', name: 'Calligraphic Arts', credits: 2, hasLab: false, theoryCredits: 2, labCredits: 0 },
    { code: 'CSC210', name: 'Professional Practices', credits: 2, hasLab: false, theoryCredits: 2, labCredits: 0, aliases: ['pp'] },
    { code: 'HUM310', name: 'Islamic History', credits: 2, hasLab: false, theoryCredits: 2, labCredits: 0 },

    // Interdisciplinary Courses
    { code: 'HUM121', name: 'Technical and Business Writing', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['tbw', 'tnb', 't&b'] },
    { code: 'MTH105', name: 'Multivariable Calculus', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['mvc'] },
    { code: 'MTH231', name: 'Linear Algebra', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['la'] },
    { code: 'MTH262', name: 'Statistics and Probability Theory', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['stats', 'prob', 'spt'] },

    // Civics and Community Engagement
    { code: 'HUM208', name: 'Civics and Community Engagement', credits: 2, hasLab: false, theoryCredits: 2, labCredits: 0, aliases: ['civics', 'cce'] },

    // Deficiency Courses (Pre-Medical)
    { code: 'MTH091', name: 'Pre-Calculus I', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['precal 1'] },
    { code: 'MTH092', name: 'Pre-Calculus II', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['precal 2'] },

    // Entrepreneurship & Writing & English
    { code: 'MGT250', name: 'Introduction to Entrepreneurship', credits: 2, hasLab: false, theoryCredits: 2, labCredits: 0 },
    { code: 'HUM120', name: 'Expository Writing', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['ew'] },
    { code: 'HUM104', name: 'Functional English', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['fe'] },

    // General Education & Ideology & Islamic Studies
    { code: 'HUM101', name: 'Understanding Quran', credits: 0, hasLab: false, theoryCredits: 0, labCredits: 0, aliases: ['quran'] },
    { code: 'HUM117', name: 'Pakistan Studies', credits: 2, hasLab: false, theoryCredits: 2, labCredits: 0, aliases: ['pst', 'pak studies'] },
    { code: 'HUM141', name: 'Seerah of Holy Prophet S.A.W.', credits: 0, hasLab: false, theoryCredits: 0, labCredits: 0, aliases: ['seerah'] },
    { code: 'HUM113', name: 'Ideology and Constitution of Pakistan', credits: 2, hasLab: false, theoryCredits: 2, labCredits: 0, aliases: ['icp'] },
    { code: 'HUM112', name: 'Islamic Studies', credits: 2, hasLab: false, theoryCredits: 2, labCredits: 0, aliases: ['isl', 'islamiat'] },
    { code: 'HUM116', name: 'Ethics', credits: 2, hasLab: false, theoryCredits: 2, labCredits: 0 },

    // Computing Core
    { code: 'CSC103', name: 'Programming Fundamentals', credits: 4, hasLab: true, theoryCredits: 3, labCredits: 1, aliases: ['pf'] },
    { code: 'CSC211', name: 'Data Structures', credits: 4, hasLab: true, theoryCredits: 3, labCredits: 1, aliases: ['ds', 'dsa'] },
    { code: 'CSC232', name: 'Information Security', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['infosec', 'is'] },
    { code: 'CSC241', name: 'Object Oriented Programming', credits: 4, hasLab: true, theoryCredits: 3, labCredits: 1, aliases: ['oop'] },
    { code: 'CSC262', name: 'Artificial Intelligence', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['ai'] },
    { code: 'CSC270', name: 'Database Systems', credits: 4, hasLab: true, theoryCredits: 3, labCredits: 1, aliases: ['db', 'dbms', 'dbs'] },
    { code: 'CSC275', name: 'Computer Networks', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['cn'] },
    { code: 'CSC291', name: 'Software Engineering', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['se'] },
    { code: 'CSC301', name: 'Design and Analysis of Algorithms', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['daa', 'algo'] },
    { code: 'CSC323', name: 'Operating Systems', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['os'] },
    { code: 'CSC325', name: 'Computer Organization and Assembly Language', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['coal'] },
    { code: 'EEE240', name: 'Fundamentals of Digital Logic Design', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['dld'] },

    // Domain Core
    { code: 'CSC312', name: 'Theory of Automata', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['toa'] },
    { code: 'CSC316', name: 'Advance Database Systems', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['adb', 'adbms'] },
    { code: 'CSC334', name: 'Parallel and Distributed Computing', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['pdc'] },
    { code: 'CSC365', name: 'HCI and Computer Graphics', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['hci', 'cg'] },
    { code: 'CSC441', name: 'Compiler Construction', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['cc'] },
    { code: 'EEE341', name: 'Introduction to Computer Architecture', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['ca', 'ica'] },

    // Domain Electives
    { code: 'AIC270', name: 'Programming for Artificial Intelligence', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['pai'] },
    { code: 'AIC341', name: 'Introduction to Computer Vision', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['cv'] },
    { code: 'AIC354', name: 'Machine Learning Fundamentals', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['ml'] },
    { code: 'AIC365', name: 'Natural Language Processing', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['nlp'] },
    { code: 'AIC380', name: 'Artificial Neural Networks and Deep Learning', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['ann', 'dl'] },
    { code: 'AIC470', name: 'Knowledge Based Systems', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['kbs'] },
    { code: 'CSC303', name: 'Mobile Application Development', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['mad'] },
    { code: 'CSC331', name: 'Digital Image Processing', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['dip'] },
    { code: 'CSC335', name: 'Game Design', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0 },
    { code: 'CSC336', name: 'Web Technologies', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['web'] },
    { code: 'CSC337', name: 'Advanced Web Technologies', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['awt'] },
    { code: 'CSC350', name: 'Topics in Computer Science I', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0 },
    { code: 'CSC353', name: 'Computer Graphics', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['cg'] },
    { code: 'CSC362', name: 'Video Production Techniques', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1 },
    { code: 'CSC367', name: 'Mobile Games and Entertainment', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1 },
    { code: 'CSC381', name: 'Blockchain Technology', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0 },
    { code: 'CSC387', name: 'Software Testing and Quality Assurance', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['sqa', 'stqa'] },
    { code: 'CSC412', name: 'Advanced Programming', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['ap'] },
    { code: 'CSC417', name: 'E-Commerce and Digital Marketing', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1 },
    { code: 'CSC418', name: 'DevOps for Cloud Computing', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['devops'] },
    { code: 'CSC421', name: 'Robotics', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0 },
    { code: 'CSC454', name: 'Pattern Recognition', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0 },
    { code: 'CSC471', name: 'Distributed Database Systems', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['ddb'] },
    { code: 'CSC475', name: 'Numerical Computing', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['nc'] },
    { code: 'CSC483', name: 'Topics in Computer Science II', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0 },
    { code: 'CSC495', name: 'Game Development', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1 },
    { code: 'CSC496', name: 'Game Engine Development', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1 },
    { code: 'CSE305', name: 'Software Requirement Engineering', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['sre'] },
    { code: 'CSE354', name: 'Design Patterns', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1 },
    { code: 'CSE494', name: 'Software Project Management', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['spm'] },
    { code: 'CYC205', name: 'Introduction to Cyber Security', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['cyber'] },
    { code: 'CYC303', name: 'Digital Forensics', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1 },
    { code: 'CYC307', name: 'Information Assurance', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0 },
    { code: 'CYC365', name: 'Network Security', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1 },
    { code: 'DSC293', name: 'Data Science Fundamentals', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1 },
    { code: 'DSC306', name: 'Data Mining', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['dm'] },
    { code: 'DSC327', name: 'Data Visualization Techniques', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1 },
    { code: 'DSC354', name: 'Data Warehousing and Business Intelligence', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['dwh', 'bi'] },
    { code: 'DSC407', name: 'Platform and Architecture for Data Science', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0 },
    { code: 'DSC415', name: 'Big Data Analytics', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['bda'] },

    // Internship
    { code: 'CSC395', name: 'Field Experience/Internship', credits: 3, hasLab: true, theoryCredits: 0, labCredits: 3, aliases: ['internship'] },

    // Supporting Electives
    { code: 'ECO484', name: 'Project Planning and Monitoring', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['ppm'] },
    { code: 'HUM220', name: 'Introduction to Psychology', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['psych'] },
    { code: 'HUM221', name: 'International Relations', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['ir'] },
    { code: 'HUM430', name: 'French', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0 },
    { code: 'HUM431', name: 'German', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0 },
    { code: 'HUM432', name: 'Arabic', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0 },
    { code: 'HUM434', name: 'Chinese', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0 },
    { code: 'MGT131', name: 'Financial Accounting', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['accounting'] },
    { code: 'MGT210', name: 'Fundamentals of Marketing', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['marketing'] },
    { code: 'MGT350', name: 'Human Resource Management', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['hrm'] },
    { code: 'MGT513', name: 'New Product Development', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['npd'] },

    // Natural Sciences
    { code: 'BIO100', name: 'Fundamentals of Biology', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['bio'] },
    { code: 'BIO310', name: 'Introduction to Bioinformatics', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1 },
    { code: 'BIO321', name: 'Fundamentals of Genetics', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1 },
    { code: 'CHM100', name: 'Introduction to Chemistry', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['chem'] },
    { code: 'PHY124', name: 'Applied Physics', credits: 3, hasLab: true, theoryCredits: 2, labCredits: 1, aliases: ['ap', 'physics'] },

    // Quantitative Reasoning
    { code: 'CSC102', name: 'Discrete Structures', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['discrete', 'ds'] },
    { code: 'MTH103', name: 'Exploring Quantitative Skills', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['eqs'] },
    { code: 'MTH104', name: 'Calculus and Analytic Geometry', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['cal', 'calculus'] },
    { code: 'MTH114', name: 'Tools for Quantitative Reasoning', credits: 3, hasLab: false, theoryCredits: 3, labCredits: 0, aliases: ['tqr'] },

    // Social Sciences
    { code: 'HUM122', name: 'Fundamentals of Psychology', credits: 2, hasLab: false, theoryCredits: 2, labCredits: 0, aliases: ['psych'] },
    { code: 'HUM130', name: 'Fundamentals of Sociology', credits: 2, hasLab: false, theoryCredits: 2, labCredits: 0, aliases: ['sociology'] },
    { code: 'HUM131', name: 'Anthropology', credits: 2, hasLab: false, theoryCredits: 2, labCredits: 0 },
    { code: 'HUM209', name: 'Fundamentals of Political Science', credits: 2, hasLab: false, theoryCredits: 2, labCredits: 0, aliases: ['pol sci'] },
    { code: 'HUM222', name: 'Fundamentals of International Relations', credits: 2, hasLab: false, theoryCredits: 2, labCredits: 0, aliases: ['ir'] },
];