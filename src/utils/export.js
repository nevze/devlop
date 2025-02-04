const { Parser } = require('json2csv');
const logger = require('../config/logger');

const flattenObject = (obj, prefix = '') => {
    return Object.keys(obj).reduce((acc, key) => {
        const pre = prefix.length ? prefix + '.' : '';
        
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
            Object.assign(acc, flattenObject(obj[key], pre + key));
        } else {
            acc[pre + key] = obj[key];
        }
        
        return acc;
    }, {});
};

const sanitizeData = (data) => {
    if (Array.isArray(data)) {
        return data.map(item => {
            if (typeof item === 'object' && item !== null) {
                const sanitized = { ...item };
                
                // Convert dates to ISO strings
                Object.keys(sanitized).forEach(key => {
                    if (sanitized[key] instanceof Date) {
                        sanitized[key] = sanitized[key].toISOString();
                    }
                });

                // Handle MongoDB _id
                if (sanitized._id) {
                    sanitized.id = sanitized._id.toString();
                    delete sanitized._id;
                }

                // Remove sensitive fields
                delete sanitized.password;
                delete sanitized.__v;

                return sanitized;
            }
            return item;
        });
    }
    return data;
};

const exportToFile = async (data, format) => {
    try {
        const sanitizedData = sanitizeData(data);

        if (format === 'json') {
            return JSON.stringify(sanitizedData, null, 2);
        }

        if (format === 'csv') {
            // Flatten nested objects for CSV
            const flattenedData = sanitizedData.map(item => flattenObject(item));

            // Get all possible fields from all items
            const fields = Array.from(
                new Set(
                    flattenedData.reduce((acc, item) => {
                        return [...acc, ...Object.keys(item)];
                    }, [])
                )
            );

            const parser = new Parser({
                fields,
                delimiter: ',',
                quote: '"',
                escape: '"',
                header: true,
                transforms: [
                    // Transform arrays to comma-separated strings
                    (value) => {
                        if (Array.isArray(value)) {
                            return value.join(', ');
                        }
                        return value;
                    }
                ]
            });

            return parser.parse(flattenedData);
        }

        throw new Error('Unsupported export format');
    } catch (error) {
        logger.error(`Export error: ${error}`);
        throw error;
    }
};

const exportFormats = {
    json: {
        contentType: 'application/json',
        extension: 'json'
    },
    csv: {
        contentType: 'text/csv',
        extension: 'csv'
    }
};

module.exports = {
    exportToFile,
    exportFormats
}; 