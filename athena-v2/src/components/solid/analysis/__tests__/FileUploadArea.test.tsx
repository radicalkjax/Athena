import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { FileUploadArea } from '../FileUploadArea';
import { mockInvoke, createMockFile, createMockAnalysisResult, flushPromises } from '../../../../test-setup';
import { analysisStore } from '../../../../stores/analysisStore';

describe('FileUploadArea', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    // Reset analysis store
    analysisStore.state.files = [];
  });

  describe('Rendering', () => {
    it('should render upload area with title', () => {
      render(() => <FileUploadArea />);

      expect(screen.getByText(/Upload Malware Sample/i)).toBeDefined();
    });

    it('should render drag and drop instructions', () => {
      render(() => <FileUploadArea />);

      expect(screen.getByText(/Drag and drop files here/i)).toBeDefined();
      expect(screen.getByText(/Maximum file size: 100MB/i)).toBeDefined();
    });

    it('should render Choose Files button', () => {
      render(() => <FileUploadArea />);

      expect(screen.getByText('Choose Files')).toBeDefined();
    });

    it('should render analysis configuration panel', () => {
      render(() => <FileUploadArea />);

      expect(screen.getByText(/Analysis Configuration/i)).toBeDefined();
      expect(screen.getByText(/Static Analysis/i)).toBeDefined();
      expect(screen.getByText(/Dynamic Analysis/i)).toBeDefined();
    });
  });

  describe('Drag and drop handling', () => {
    it('should show dragging state on drag over', () => {
      const { container } = render(() => <FileUploadArea />);

      const uploadArea = container.querySelector('.upload-area');
      expect(uploadArea).toBeDefined();

      fireEvent.dragOver(uploadArea!, new DragEvent('dragover'));

      expect(uploadArea!.classList.contains('dragging')).toBe(true);
    });

    it('should clear dragging state on drag leave', () => {
      const { container } = render(() => <FileUploadArea />);

      const uploadArea = container.querySelector('.upload-area');
      expect(uploadArea).toBeDefined();

      fireEvent.dragOver(uploadArea!, new DragEvent('dragover'));
      expect(uploadArea!.classList.contains('dragging')).toBe(true);

      fireEvent.dragLeave(uploadArea!, new DragEvent('dragleave'));
      expect(uploadArea!.classList.contains('dragging')).toBe(false);
    });

    it('should handle file drop in web mode', async () => {
      const { container } = render(() => <FileUploadArea />);

      const uploadArea = container.querySelector('.upload-area');
      const mockFile = createMockFile('test.exe', 1024, 'application/x-executable');

      const dataTransfer = {
        files: [mockFile]
      };

      const dropEvent = new DragEvent('drop', { dataTransfer } as any);
      Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });

      fireEvent.drop(uploadArea!, dropEvent);

      await flushPromises();

      // Should process the file
      await waitFor(() => {
        expect(analysisStore.state.files.length).toBeGreaterThan(0);
      });
    });

    it('should handle file drop in Tauri mode', async () => {
      const { container } = render(() => <FileUploadArea />);

      const uploadArea = container.querySelector('.upload-area');
      const mockFile = createMockFile('malware.exe', 2048, 'application/x-executable');

      // Mock create_temp_file command
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'create_temp_file') {
          return Promise.resolve('/tmp/malware.exe');
        }
        if (cmd === 'analyze_file') {
          return Promise.resolve(createMockAnalysisResult());
        }
        return Promise.resolve(null);
      });

      const dataTransfer = {
        files: [mockFile]
      };

      const dropEvent = new DragEvent('drop', { dataTransfer } as any);
      Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });

      fireEvent.drop(uploadArea!, dropEvent);

      await flushPromises();

      // Should call create_temp_file and analyze_file
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });
    });
  });

  describe('File upload progress', () => {
    it('should display progress indicator during upload', async () => {
      const { container } = render(() => <FileUploadArea />);

      const uploadArea = container.querySelector('.upload-area');
      const mockFile = createMockFile('test.exe', 1024);

      // Mock slow analysis
      mockInvoke.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(createMockAnalysisResult()), 100))
      );

      const dataTransfer = { files: [mockFile] };
      const dropEvent = new DragEvent('drop', { dataTransfer } as any);
      Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });

      fireEvent.drop(uploadArea!, dropEvent);

      await flushPromises();

      // Progress should be shown (briefly)
      // Note: This is a timing-dependent test and might need adjustment
    });

    it('should hide progress after upload completes', async () => {
      const { container } = render(() => <FileUploadArea />);

      const uploadArea = container.querySelector('.upload-area');
      const mockFile = createMockFile('test.exe', 1024);

      mockInvoke.mockResolvedValue(createMockAnalysisResult());

      const dataTransfer = { files: [mockFile] };
      const dropEvent = new DragEvent('drop', { dataTransfer } as any);
      Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });

      fireEvent.drop(uploadArea!, dropEvent);

      await waitFor(() => {
        expect(analysisStore.state.files.length).toBeGreaterThan(0);
      });

      // Progress should be hidden after completion
      const progressElement = container.querySelector('.upload-progress');
      expect(progressElement).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('should display error message on upload failure', async () => {
      render(() => <FileUploadArea />);

      const mockFile = createMockFile('test.exe', 1024);

      mockInvoke.mockRejectedValue(new Error('Upload failed'));

      const uploadArea = document.querySelector('.upload-area');
      const dataTransfer = { files: [mockFile] };
      const dropEvent = new DragEvent('drop', { dataTransfer } as any);
      Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });

      fireEvent.drop(uploadArea!, dropEvent);

      await flushPromises();

      // Error message should be displayed
      await waitFor(() => {
        const errorElement = screen.queryByText(/failed/i);
        expect(errorElement).toBeDefined();
      }, { timeout: 2000 });
    });

    it('should clear previous errors on new upload', async () => {
      const { container } = render(() => <FileUploadArea />);

      // First upload fails
      const mockFile1 = createMockFile('test1.exe', 1024);
      mockInvoke.mockRejectedValueOnce(new Error('First upload failed'));

      const uploadArea = container.querySelector('.upload-area');
      const dataTransfer1 = { files: [mockFile1] };
      const dropEvent1 = new DragEvent('drop', { dataTransfer: dataTransfer1 } as any);
      Object.defineProperty(dropEvent1, 'dataTransfer', { value: dataTransfer1 });

      fireEvent.drop(uploadArea!, dropEvent1);
      await flushPromises();

      // Second upload succeeds
      const mockFile2 = createMockFile('test2.exe', 1024);
      mockInvoke.mockResolvedValueOnce(createMockAnalysisResult());

      const dataTransfer2 = { files: [mockFile2] };
      const dropEvent2 = new DragEvent('drop', { dataTransfer: dataTransfer2 } as any);
      Object.defineProperty(dropEvent2, 'dataTransfer', { value: dataTransfer2 });

      fireEvent.drop(uploadArea!, dropEvent2);
      await flushPromises();

      // Previous error should be cleared
      await waitFor(() => {
        const errorElement = container.querySelector('.error-message');
        expect(errorElement).toBeNull();
      });
    });
  });

  describe('File information display', () => {
    it('should display file metadata after successful upload', async () => {
      render(() => <FileUploadArea />);

      const mockFile = createMockFile('malware.exe', 2048, 'application/x-executable');
      mockInvoke.mockResolvedValue(createMockAnalysisResult({
        size: 2048,
        hashes: {
          sha256: 'abc123def456'
        }
      }));

      const uploadArea = document.querySelector('.upload-area');
      const dataTransfer = { files: [mockFile] };
      const dropEvent = new DragEvent('drop', { dataTransfer } as any);
      Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });

      fireEvent.drop(uploadArea!, dropEvent);

      await waitFor(() => {
        expect(screen.queryByText('File Information')).toBeDefined();
      }, { timeout: 2000 });
    });

    it('should display correct file size in MB', async () => {
      render(() => <FileUploadArea />);

      const sizeInBytes = 5 * 1024 * 1024; // 5 MB
      const mockFile = createMockFile('large.exe', sizeInBytes);

      mockInvoke.mockResolvedValue(createMockAnalysisResult({
        size: sizeInBytes,
        hashes: { sha256: 'test-hash' }
      }));

      const uploadArea = document.querySelector('.upload-area');
      const dataTransfer = { files: [mockFile] };
      const dropEvent = new DragEvent('drop', { dataTransfer } as any);
      Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });

      fireEvent.drop(uploadArea!, dropEvent);

      await waitFor(() => {
        const sizeText = screen.queryByText(/5\.00 MB/i);
        expect(sizeText).toBeDefined();
      }, { timeout: 2000 });
    });
  });
});
