pub mod encoding;
pub mod crypto;
pub mod javascript;
pub mod powershell;
pub mod binary;

use crate::types::ObfuscationTechnique;

#[derive(Debug, Clone)]
pub struct TechniqueResult {
    pub success: bool,
    pub output: String,
    pub context: Option<String>,
}

pub trait DeobfuscationTechnique: Send + Sync {
    fn name(&self) -> &'static str;
    
    fn can_deobfuscate(&self, content: &str) -> Option<f32>;
    
    fn deobfuscate(&self, content: &str) -> Result<TechniqueResult, String>;
    
    fn matches_type(&self, technique_type: &ObfuscationTechnique) -> bool;
}