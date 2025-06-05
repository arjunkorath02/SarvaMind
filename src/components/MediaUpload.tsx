
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Image, Video, Music, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface MediaFile {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'video' | 'document' | 'audio' | 'archive';
  url?: string;
}

interface MediaUploadProps {
  onFilesSelected: (files: MediaFile[]) => void;
  selectedFiles: MediaFile[];
  onRemoveFile: (id: string) => void;
}

const MediaUpload: React.FC<MediaUploadProps> = ({ onFilesSelected, selectedFiles, onRemoveFile }) => {
  const [uploading, setUploading] = useState(false);

  const getFileType = (file: File): 'image' | 'video' | 'document' | 'audio' | 'archive' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || 
        file.type === 'application/x-rar-compressed' || file.type === 'application/x-7z-compressed') {
      return 'archive';
    }
    return 'document';
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'audio': return <Music className="w-4 h-4" />;
      case 'archive': return <Archive className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const uploadToSupabase = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('chat-media')
      .upload(fileName, file);

    if (error) {
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('chat-media')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true);
    
    try {
      const mediaFiles: MediaFile[] = await Promise.all(
        acceptedFiles.map(async (file) => {
          const type = getFileType(file);
          const url = await uploadToSupabase(file);
          
          let preview;
          if (type === 'image') {
            preview = URL.createObjectURL(file);
          }

          return {
            id: Math.random().toString(36).substring(2),
            file,
            preview,
            type,
            url
          };
        })
      );

      onFilesSelected([...selectedFiles, ...mediaFiles]);
      toast({
        title: "Files uploaded successfully",
        description: `${acceptedFiles.length} file(s) uploaded`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }, [selectedFiles, onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
      'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm'],
      'audio/*': ['.mp3', '.wav', '.ogg'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
      'application/x-rar-compressed': ['.rar'],
      'application/x-7z-compressed': ['.7z'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  return (
    <div className="space-y-3">
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          {selectedFiles.map((mediaFile) => (
            <div key={mediaFile.id} className="glass-card p-3 rounded-lg flex items-center gap-3">
              {mediaFile.type === 'image' && mediaFile.preview && (
                <img src={mediaFile.preview} alt="Preview" className="w-12 h-12 object-cover rounded" />
              )}
              {mediaFile.type === 'video' && (
                <video src={mediaFile.preview} className="w-12 h-12 object-cover rounded" />
              )}
              {(mediaFile.type === 'document' || mediaFile.type === 'audio' || mediaFile.type === 'archive') && (
                <div className="w-12 h-12 glass rounded flex items-center justify-center">
                  {getFileIcon(mediaFile.type)}
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm text-white truncate">{mediaFile.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(mediaFile.file.size / 1024 / 1024).toFixed(2)} MB
                  {mediaFile.type === 'archive' && ' (Archive)'}
                </p>
              </div>
              <Button
                onClick={() => onRemoveFile(mediaFile.id)}
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div
        {...getRootProps()}
        className={`glass-card rounded-lg p-4 border-2 border-dashed transition-colors cursor-pointer ${
          isDragActive ? 'border-primary bg-primary/10' : 'border-primary/30 hover:border-primary/50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex items-center justify-center gap-3 text-center">
          <Upload className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm text-white">
              {uploading ? 'Uploading...' : isDragActive ? 'Drop files here' : 'Drag files or click to upload'}
            </p>
            <p className="text-xs text-muted-foreground">
              Images, videos, documents, audio, ZIP files (max 50MB)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaUpload;
