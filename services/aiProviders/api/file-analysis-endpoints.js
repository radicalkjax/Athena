/**
 * File Analysis API Endpoints
 * Handles file uploads, analysis, and batch processing
 */

const { Router } = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const { getOrchestrator, analyzeContent } = require('../index');
const { logger } = require('../../../utils/logger');
const { getCache } = require('../../cache/redis-cache');
const cacheService = getCache();

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../../uploads');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: process.env.MAX_FILE_SIZE || 52428800, // 50MB default
        files: 10 // Max 10 files for batch upload
    },
    fileFilter: (req, file, cb) => {
        // Add file type restrictions if needed
        // For malware analysis, we might want to accept all file types
        cb(null, true);
    }
});

// Authentication middleware
function authenticateRequest(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }
    next();
}

/**
 * Upload file for analysis
 * POST /api/v1/analysis/upload
 */
router.post('/upload', authenticateRequest, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const { analysisType = 'comprehensive', priority = 'normal', metadata = {} } = req.body;
        
        // Generate analysis ID
        const analysisId = crypto.randomBytes(16).toString('hex');
        
        // Read file content
        const fileContent = await fs.readFile(req.file.path);
        
        // Store analysis metadata
        await cacheService.set(`analysis:${analysisId}:metadata`, JSON.stringify({
            id: analysisId,
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            uploadTime: new Date().toISOString(),
            status: 'pending',
            analysisType,
            priority
        }), 3600); // 1 hour TTL

        // Start async analysis
        processFileAnalysis(analysisId, fileContent, {
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            analysisType,
            priority,
            metadata
        });

        // Clean up uploaded file
        fs.unlink(req.file.path).catch(err => logger.error('Failed to delete uploaded file', { error: err }));

        res.json({
            analysisId,
            status: 'pending',
            message: 'File uploaded successfully. Analysis in progress.',
            filename: req.file.originalname,
            size: req.file.size
        });

    } catch (error) {
        logger.error('File upload failed', { error });
        res.status(500).json({
            error: 'File upload failed',
            message: error.message
        });
    }
});

/**
 * Upload multiple files for batch analysis
 * POST /api/v1/analysis/batch
 */
router.post('/batch', authenticateRequest, upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files provided' });
        }

        const { analysisType = 'comprehensive', priority = 'normal', metadata = {} } = req.body;
        const batchId = crypto.randomBytes(16).toString('hex');
        const analyses = [];

        // Create analysis jobs for each file
        for (const file of req.files) {
            const analysisId = crypto.randomBytes(16).toString('hex');
            const fileContent = await fs.readFile(file.path);
            
            analyses.push({
                id: analysisId,
                filename: file.originalname,
                size: file.size,
                status: 'pending'
            });

            // Store individual analysis metadata
            await cacheService.set(`analysis:${analysisId}:metadata`, JSON.stringify({
                id: analysisId,
                batchId,
                filename: file.originalname,
                size: file.size,
                mimetype: file.mimetype,
                uploadTime: new Date().toISOString(),
                status: 'pending',
                analysisType,
                priority
            }), 3600);

            // Start async analysis
            processFileAnalysis(analysisId, fileContent, {
                batchId,
                filename: file.originalname,
                size: file.size,
                mimetype: file.mimetype,
                analysisType,
                priority,
                metadata
            });

            // Clean up uploaded file
            fs.unlink(file.path).catch(err => logger.error('Failed to delete uploaded file', { error: err }));
        }

        // Store batch metadata
        await cacheService.set(`batch:${batchId}:metadata`, JSON.stringify({
            id: batchId,
            totalFiles: req.files.length,
            analyses: analyses.map(a => a.id),
            uploadTime: new Date().toISOString(),
            status: 'processing'
        }), 3600);

        res.json({
            batchId,
            totalFiles: req.files.length,
            analyses,
            status: 'processing',
            message: 'Batch upload successful. Analysis in progress.'
        });

    } catch (error) {
        logger.error('Batch upload failed', { error });
        res.status(500).json({
            error: 'Batch upload failed',
            message: error.message
        });
    }
});

/**
 * Get analysis status
 * GET /api/v1/analysis/:id/status
 */
router.get('/:id/status', authenticateRequest, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get analysis metadata
        const metadataStr = await cacheService.get(`analysis:${id}:metadata`);
        if (!metadataStr) {
            return res.status(404).json({ error: 'Analysis not found' });
        }

        const metadata = JSON.parse(metadataStr);
        
        // Get progress if available
        const progressStr = await cacheService.get(`analysis:${id}:progress`);
        const progress = progressStr ? JSON.parse(progressStr) : null;

        res.json({
            id,
            status: metadata.status,
            filename: metadata.filename,
            uploadTime: metadata.uploadTime,
            progress,
            ...(metadata.completedTime && { completedTime: metadata.completedTime })
        });

    } catch (error) {
        logger.error('Failed to get analysis status', { error });
        res.status(500).json({
            error: 'Failed to get analysis status',
            message: error.message
        });
    }
});

/**
 * Get analysis results
 * GET /api/v1/analysis/:id/results
 */
router.get('/:id/results', authenticateRequest, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get analysis metadata
        const metadataStr = await cacheService.get(`analysis:${id}:metadata`);
        if (!metadataStr) {
            return res.status(404).json({ error: 'Analysis not found' });
        }

        const metadata = JSON.parse(metadataStr);
        
        if (metadata.status !== 'completed') {
            return res.status(202).json({
                status: metadata.status,
                message: 'Analysis not yet completed'
            });
        }

        // Get results
        const resultsStr = await cacheService.get(`analysis:${id}:results`);
        if (!resultsStr) {
            return res.status(404).json({ error: 'Results not found' });
        }

        const results = JSON.parse(resultsStr);
        
        res.json({
            id,
            filename: metadata.filename,
            analysisType: metadata.analysisType,
            completedTime: metadata.completedTime,
            results
        });

    } catch (error) {
        logger.error('Failed to get analysis results', { error });
        res.status(500).json({
            error: 'Failed to get analysis results',
            message: error.message
        });
    }
});

/**
 * Process file analysis asynchronously
 */
async function processFileAnalysis(analysisId, fileContent, options) {
    try {
        // Update status to processing
        const metadataStr = await cacheService.get(`analysis:${analysisId}:metadata`);
        const metadata = JSON.parse(metadataStr);
        metadata.status = 'processing';
        await cacheService.set(`analysis:${analysisId}:metadata`, JSON.stringify(metadata), 3600);

        // Update progress
        await cacheService.set(`analysis:${analysisId}:progress`, JSON.stringify({
            stage: 'preprocessing',
            percentage: 10
        }), 300);

        // Perform analysis
        const result = await analyzeContent(fileContent, {
            analysisType: options.analysisType,
            priority: options.priority,
            metadata: {
                ...options.metadata,
                filename: options.filename,
                size: options.size,
                mimetype: options.mimetype
            },
            progressCallback: async (progress) => {
                await cacheService.set(`analysis:${analysisId}:progress`, JSON.stringify(progress), 300);
            }
        });

        // Store results
        await cacheService.set(`analysis:${analysisId}:results`, JSON.stringify(result), 3600);

        // Update metadata
        metadata.status = 'completed';
        metadata.completedTime = new Date().toISOString();
        await cacheService.set(`analysis:${analysisId}:metadata`, JSON.stringify(metadata), 3600);

        // If part of a batch, update batch status
        if (options.batchId) {
            await updateBatchStatus(options.batchId);
        }

    } catch (error) {
        logger.error('File analysis failed', { analysisId, error });
        
        // Update status to failed
        try {
            const metadataStr = await cacheService.get(`analysis:${analysisId}:metadata`);
            const metadata = JSON.parse(metadataStr);
            metadata.status = 'failed';
            metadata.error = error.message;
            await cacheService.set(`analysis:${analysisId}:metadata`, JSON.stringify(metadata), 3600);
        } catch (updateError) {
            logger.error('Failed to update analysis status', { analysisId, error: updateError });
        }
    }
}

/**
 * Update batch status when individual analyses complete
 */
async function updateBatchStatus(batchId) {
    try {
        const batchMetadataStr = await cacheService.get(`batch:${batchId}:metadata`);
        if (!batchMetadataStr) return;

        const batchMetadata = JSON.parse(batchMetadataStr);
        let completedCount = 0;
        let failedCount = 0;

        // Check status of all analyses in the batch
        for (const analysisId of batchMetadata.analyses) {
            const analysisMetadataStr = await cacheService.get(`analysis:${analysisId}:metadata`);
            if (analysisMetadataStr) {
                const analysisMetadata = JSON.parse(analysisMetadataStr);
                if (analysisMetadata.status === 'completed') completedCount++;
                if (analysisMetadata.status === 'failed') failedCount++;
            }
        }

        // Update batch status
        if (completedCount + failedCount === batchMetadata.totalFiles) {
            batchMetadata.status = failedCount > 0 ? 'completed_with_errors' : 'completed';
            batchMetadata.completedCount = completedCount;
            batchMetadata.failedCount = failedCount;
            batchMetadata.completedTime = new Date().toISOString();
            await cacheService.set(`batch:${batchId}:metadata`, JSON.stringify(batchMetadata), 3600);
        }
    } catch (error) {
        logger.error('Failed to update batch status', { batchId, error });
    }
}

module.exports = router;