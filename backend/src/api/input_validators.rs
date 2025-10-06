/// 输入验证助手函数模块
/// 用于统一处理各类用户输入的验证和清理逻辑，消除重复的验证代码

use crate::api::errors::ApiError;

/// 输入验证助手
pub struct InputValidators;

impl InputValidators {
    /// 验证并清理字符串输入 (去除首尾空格)
    pub fn validate_and_clean_string(input: &str, field_name: &str) -> Result<String, ApiError> {
        let cleaned = input.trim().to_string();
        Self::validate_not_empty(&cleaned, field_name)?;
        Ok(cleaned)
    }

    /// 验证字符串是否为空 (已清理)
    pub fn validate_not_empty(input: &str, field_name: &str) -> Result<(), ApiError> {
        if input.is_empty() {
            return Err(ApiError::bad_request(&format!("{}不能为空", field_name)));
        }
        Ok(())
    }

    /// 验证多个必填字段是否都不为空
    pub fn validate_required_fields(fields: &[(&str, &str)]) -> Result<(), ApiError> {
        for (value, field_name) in fields {
            Self::validate_not_empty(value.trim(), field_name)?;
        }
        Ok(())
    }

    /// 验证密码强度 (最少6位)
    pub fn validate_password(password: &str) -> Result<(), ApiError> {
        if password.len() < 6 {
            return Err(ApiError::bad_request("密码至少需要6位"));
        }
        Ok(())
    }

    /// 验证邮箱格式 (基础验证: 非空且包含@)
    pub fn validate_email_basic(email: &str) -> Result<String, ApiError> {
        let cleaned = email.trim().to_string();
        Self::validate_not_empty(&cleaned, "邮箱")?;
        if !cleaned.contains('@') {
            return Err(ApiError::bad_request("邮箱格式无效"));
        }
        Ok(cleaned)
    }

    /// 验证搜索关键词长度 (至少2个字符)
    pub fn validate_search_keyword(keyword: &str) -> Result<(), ApiError> {
        if keyword.len() < 2 {
            return Err(ApiError::bad_request("搜索关键词至少需要2个字符"));
        }
        Ok(())
    }

    /// 验证列表是否非空
    pub fn validate_list_not_empty<T>(list: &[T], list_name: &str) -> Result<(), ApiError> {
        if list.is_empty() {
            return Err(ApiError::bad_request(&format!("{}列表不能为空", list_name)));
        }
        Ok(())
    }

    /// 清理查询参数 (去除空格，提供默认值)
    pub fn clean_query_param(param: Option<&str>) -> String {
        param.map(|s| s.trim().to_string()).unwrap_or_default()
    }

    /// 生成用于模糊匹配的email pattern
    pub fn generate_email_like_pattern(username: &str) -> String {
        let lower_username = username.to_lowercase();
        if lower_username.is_empty() {
            "#no_match#%".to_string()
        } else {
            format!("{}@%", lower_username)
        }
    }

    /// 验证和处理可选的邮箱字段
    pub fn process_optional_email(email: Option<&str>) -> Result<Option<String>, ApiError> {
        match email {
            Some(e) => {
                let cleaned = e.trim();
                if cleaned.is_empty() {
                    Ok(None)
                } else {
                    Ok(Some(Self::validate_email_basic(cleaned)?))
                }
            }
            None => Ok(None)
        }
    }
}