const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        /* Base Styles */
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 0;
            background-color: #f4f4f4;
        }
        .main-container {
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin: 20px auto;
        }
        
        /* Header Styles */
        .header {
            background-color: #0047AB; /* NMGA primary blue */
            padding: 20px;
            text-align: center;
            color: white;
        }
        .logo {
            max-width: 150px;
            height: auto;
        }
        .header-title {
            margin: 10px 0 0;
            font-size: 22px;
            font-weight: bold;
        }
        .header-subtitle {
            margin: 5px 0;
            font-size: 14px;
            font-weight: normal;
        }
        
        /* Content Styles */
        .content {
            padding: 30px 20px;
            background-color: #ffffff;
        }
        
        /* Typography */
        h1, h2, h3 {
            color: #0047AB; /* NMGA primary blue */
            font-weight: bold;
            margin-top: 0;
        }
        h1 { font-size: 26px; }
        h2 { font-size: 22px; }
        h3 { font-size: 18px; }
        p { 
            margin-bottom: 16px; 
            color: #333;
        }
        
        /* Lists */
        ul, ol {
            margin-bottom: 20px;
            padding-left: 20px;
        }
        ul li, ol li {
            margin-bottom: 8px;
        }
        
        /* Alert Boxes */
        .alert-box {
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
        }
        .alert-success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .alert-warning {
            background-color: #fff3cd;
            color: #856404;
            border: 1px solid #ffeeba;
        }
        .alert-danger {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .alert-info {
            background-color: #f8f9fa;
            color: #1b1e21;
            border: 1px solid #d6d8db;
        }
        .alert-primary {
            background-color: #e6f2ff;
            color: #004085;
            border: 1px solid #b8daff;
        }
        
        /* Buttons */
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #0047AB; /* NMGA primary blue */
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 0;
            font-weight: bold;
            text-align: center;
            border: none;
            font-size: 16px;
        }
        .button:hover {
            background-color: #003399; /* Darker blue on hover */
        }
        
        /* Dividers */
        .divider {
            height: 1px;
            background-color: #dee2e6;
            margin: 15px 0;
        }
        
        /* Cards */
        .card {
            border: 1px solid #dee2e6;
            padding: 15px;
            margin: 10px 0;
            border-radius: 8px;
            background-color: #ffffff;
        }
        .card-header {
            margin-top: 0;
            color: #0047AB;
        }
        
        /* Footer Styles */
        .footer {
            background-color: #f8f9fa;
            text-align: center;
            padding: 20px;
            font-size: 0.9em;
            color: #6c757d;
            border-top: 1px solid #dee2e6;
        }
        .social-links {
            margin: 15px 0;
        }
        .social-link {
            display: inline-block;
            margin: 0 8px;
            color: #0047AB;
            text-decoration: none;
        }
        .contact-info {
            margin-top: 10px;
            font-size: 0.85em;
        }
    </style>
</head>
<body>
    <div class="main-container">
        <div class="header">
            <!-- Replace with actual logo URL if available -->
            <img src="https://nmga.rtnglobal.site/fav.png" alt="NMGA Logo" class="logo">
            
            <p style="font-size: 14px; font-weight: bold; color: white;">New Mexico Grocers Association</p>
        </div>
        
        <div class="content">
            ${content}
        </div>
        
        <div class="footer">
          
            <p>© ${new Date().getFullYear()} NMGA. All rights reserved.</p>
            <p>This is an automated message, please do not reply directly to this email.</p>
        </div>
    </div>
</body>
</html>
`;

module.exports = baseTemplate; 