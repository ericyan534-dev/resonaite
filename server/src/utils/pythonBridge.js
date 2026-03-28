const { spawn } = require('child_process');
const path = require('path');
const config = require('../config/env');

/**
 * CIM Pipeline Bridge
 *
 * Spawns Python subprocess to run the Resonaite Modulation (CIM) pipeline
 * Communicates via JSON on stdout
 */

/**
 * Process audio through CIM pipeline
 *
 * @param {string} inputPath - Absolute path to input audio file
 * @param {string} presetName - Preset name (e.g., 'focus_beta_18hz')
 * @param {string} outputDir - Output directory for processed audio
 * @param {object} customParams - Custom parameters (optional)
 *
 * @returns {Promise<object>} {
 *   success: boolean,
 *   outputPath?: string,
 *   metrics?: object,
 *   error?: string,
 *   processingTime?: number
 * }
 */
async function processCIM(inputPath, presetName, outputDir, customParams = {}) {
  return new Promise((resolve, reject) => {
    // Resolve Python path
    const pythonPath = config.PYTHON_PATH;
    const cimWrapperPath = path.join(__dirname, '../python/cim_wrapper.py');

    // Build arguments
    const args = [
      cimWrapperPath,
      '--input', inputPath,
      '--preset', presetName,
      '--output-dir', outputDir
    ];

    if (Object.keys(customParams).length > 0) {
      args.push('--params');
      args.push(JSON.stringify(customParams));
    }

    // Spawn Python process
    const pythonProcess = spawn(pythonPath, args, {
      cwd: path.join(__dirname, '../..'),
      env: {
        ...process.env,
        CIM_PIPELINE_PATH: config.CIM_PIPELINE_PATH
      },
      timeout: 5 * 60 * 1000 // 5 minute timeout
    });

    let stdout = '';
    let stderr = '';

    // Collect stdout
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Collect stderr for debugging
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      if (config.isDevelopment()) {
        console.log('CIM stderr:', data.toString());
      }
    });

    // Handle process exit
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        const errorMsg = stderr || `Python process exited with code ${code}`;
        return reject(new Error(`CIM processing failed: ${errorMsg}`));
      }

      // Parse JSON output
      try {
        const result = JSON.parse(stdout);
        if (!result.success) {
          return reject(new Error(result.error || 'CIM processing failed'));
        }
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse CIM output: ${err.message}`));
      }
    });

    // Handle process errors
    pythonProcess.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
}

/**
 * Check if Python is available
 */
function checkPythonAvailable() {
  return new Promise((resolve) => {
    const pythonPath = config.PYTHON_PATH;
    const proc = spawn(pythonPath, ['--version']);

    proc.on('close', (code) => {
      resolve(code === 0);
    });

    proc.on('error', () => {
      resolve(false);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 5000);
  });
}

module.exports = {
  processCIM,
  checkPythonAvailable
};
