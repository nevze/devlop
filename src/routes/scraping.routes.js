const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validation.middleware');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

// Scrape webpage
router.post('/webpage', [
    body('url').trim().isURL().withMessage('Please provide a valid URL'),
    body('selector').optional().trim(),
    validateRequest
], async (req, res) => {
    const { url, selector } = req.body;
    
    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle0' });
        
        let content;
        if (selector) {
            content = await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                return element ? element.innerHTML : null;
            }, selector);
        } else {
            content = await page.content();
        }
        
        await browser.close();
        
        res.status(200).json({
            status: 'success',
            data: { content }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Error scraping webpage',
            error: error.message
        });
    }
});

// Extract data from HTML
router.post('/extract', [
    body('html').notEmpty().withMessage('HTML content is required'),
    body('selectors').isArray().withMessage('Selectors must be an array'),
    validateRequest
], async (req, res) => {
    const { html, selectors } = req.body;
    
    try {
        const $ = cheerio.load(html);
        const results = {};
        
        selectors.forEach(selector => {
            results[selector] = $(selector).text().trim();
        });
        
        res.status(200).json({
            status: 'success',
            data: { results }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Error extracting data',
            error: error.message
        });
    }
});

// Take screenshot
router.post('/screenshot', [
    body('url').trim().isURL().withMessage('Please provide a valid URL'),
    body('fullPage').optional().isBoolean(),
    validateRequest
], async (req, res) => {
    const { url, fullPage = false } = req.body;
    
    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle0' });
        
        const screenshot = await page.screenshot({
            fullPage,
            encoding: 'base64'
        });
        
        await browser.close();
        
        res.status(200).json({
            status: 'success',
            data: { screenshot: `data:image/png;base64,${screenshot}` }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Error taking screenshot',
            error: error.message
        });
    }
});

// Generate PDF
router.post('/pdf', [
    body('url').trim().isURL().withMessage('Please provide a valid URL'),
    body('options').optional().isObject(),
    validateRequest
], async (req, res) => {
    const { url, options = {} } = req.body;
    
    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle0' });
        
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            ...options
        });
        
        await browser.close();
        
        res.status(200).json({
            status: 'success',
            data: { pdf: pdf.toString('base64') }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Error generating PDF',
            error: error.message
        });
    }
});

module.exports = router; 