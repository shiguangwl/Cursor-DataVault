from flask import Flask, render_template, request, jsonify, redirect, url_for
import sqlite3
import json
import os
from datetime import datetime
import glob

app = Flask(__name__)

# 配置文件路径
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json')

# 默认配置
DEFAULT_CONFIG = {
    'db_path': '/Users/mac/Library/Application Support/Cursor/User/globalStorage/state.vscdb'
}

def load_config():
    """加载配置文件"""
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            # 如果配置文件不存在，创建默认配置
            save_config(DEFAULT_CONFIG)
            return DEFAULT_CONFIG
    except Exception as e:
        print(f"加载配置文件失败: {e}")
        return DEFAULT_CONFIG

def save_config(config):
    """保存配置文件"""
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"保存配置文件失败: {e}")
        return False

class DatabaseManager:
    def __init__(self, db_path=None):
        config = load_config()
        if db_path is None:
            self.db_path = config.get('db_path', DEFAULT_CONFIG['db_path'])
        else:
            self.db_path = db_path
    
    def get_connection(self):
        """获取数据库连接"""
        try:
            if not os.path.exists(self.db_path):
                raise FileNotFoundError(f"数据库文件不存在: {self.db_path}")
            
            # 检查文件权限
            if not os.access(self.db_path, os.R_OK):
                raise PermissionError(f"没有读取数据库文件的权限: {self.db_path}")
            
            return sqlite3.connect(self.db_path)
        except Exception as e:
            print(f"数据库连接错误: {e}")
            raise
    
    def get_all_keys(self):
        """获取所有key列表"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT key FROM main.ItemTable ORDER BY key")
                return [row[0] for row in cursor.fetchall()]
        except Exception as e:
            print(f"获取key列表时出错: {e}")
            return []
    
    def get_record_by_key(self, target_key):
        """根据key获取记录"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT key, value FROM main.ItemTable WHERE key = ?", (target_key,))
                row = cursor.fetchone()
                
                if not row:
                    return None, "未找到指定的key"
                
                record_key, blob_data = row
                
                if not blob_data:
                    return {"key": record_key, "value": None, "raw_value": "", "is_json": False}, None
                
                try:
                    # 解码数据
                    if isinstance(blob_data, bytes):
                        raw_string = blob_data.decode('utf-8')
                    else:
                        raw_string = str(blob_data)
                    
                    # 尝试解析JSON
                    try:
                        json_object = json.loads(raw_string)
                        return {
                            "key": record_key,
                            "value": json_object,
                            "raw_value": raw_string,
                            "is_json": True
                        }, None
                    except json.JSONDecodeError:
                        # 如果不是有效JSON，返回原始数据
                        return {
                            "key": record_key,
                            "value": raw_string,
                            "raw_value": raw_string,
                            "is_json": False
                        }, None
                    
                except UnicodeDecodeError:
                    return None, f"key '{target_key}' 的数据无法解码为UTF-8格式"
                    
        except Exception as e:
            return None, f"数据库查询错误: {e}"
    
    def update_record(self, target_key, new_value):
        """更新记录"""
        try:
            # 尝试验证JSON格式，但不强制要求
            json_value = new_value
            if isinstance(new_value, str):
                try:
                    # 尝试解析JSON以验证格式
                    json.loads(new_value)
                    # 如果是有效JSON，保持原样
                    json_value = new_value
                except json.JSONDecodeError:
                    # 如果不是有效JSON，直接保存原始字符串
                    json_value = new_value
            else:
                # 如果不是字符串，转换为JSON
                json_value = json.dumps(new_value, ensure_ascii=False)
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("UPDATE main.ItemTable SET value = ? WHERE key = ?", 
                             (json_value, target_key))
                
                if cursor.rowcount == 0:
                    return False, "未找到要更新的记录"
                
                conn.commit()
                return True, "更新成功"
                
        except Exception as e:
            return False, f"更新失败: {e}"
    
    
    def delete_record(self, target_key):
        """删除记录"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM main.ItemTable WHERE key = ?", (target_key,))
                
                if cursor.rowcount == 0:
                    return False, "未找到要删除的记录"
                
                conn.commit()
                return True, "删除成功"
                
        except Exception as e:
            return False, f"删除失败: {e}"

# 初始化数据库管理器
try:
    # 加载配置
    config = load_config()
    db_manager = DatabaseManager(config.get('db_path'))
    print(f"数据库连接成功: {db_manager.db_path}")
except Exception as e:
    print(f"数据库初始化失败: {e}")
    db_manager = None

@app.route('/')
def index():
    """主页面"""
    try:
        if db_manager is None:
            return "数据库连接失败，请检查数据库文件路径和权限", 500
        
        keys = db_manager.get_all_keys()
        return render_template('index.html', keys=keys)
    except Exception as e:
        print(f"主页面加载错误: {e}")
        return f"页面加载失败: {e}", 500

@app.route('/api/keys')
def get_keys():
    """获取所有key的API接口"""
    try:
        if db_manager is None:
            return jsonify({"error": "数据库连接失败"}), 500
        
        keys = db_manager.get_all_keys()
        return jsonify({"keys": keys})
    except Exception as e:
        print(f"获取keys API错误: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/record/<path:key>')
def get_record(key):
    """获取指定key的记录"""
    try:
        if db_manager is None:
            return jsonify({"success": False, "error": "数据库连接失败"}), 500
        
        record, error = db_manager.get_record_by_key(key)
        if error:
            return jsonify({"success": False, "error": error}), 404
        return jsonify({"success": True, "data": record})
    except Exception as e:
        print(f"获取记录API错误: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/record/<path:key>', methods=['PUT'])
def update_record(key):
    """更新记录"""
    try:
        if db_manager is None:
            return jsonify({"success": False, "error": "数据库连接失败"}), 500
        
        data = request.get_json()
        new_value = data.get('value')
        
        if not new_value:
            return jsonify({"success": False, "error": "缺少value参数"}), 400
        
        success, message = db_manager.update_record(key, new_value)
        return jsonify({"success": success, "message": message})
    except Exception as e:
        print(f"更新记录API错误: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/record/<path:key>', methods=['DELETE'])
def delete_record(key):
    """删除记录"""
    try:
        if db_manager is None:
            return jsonify({"success": False, "error": "数据库连接失败"}), 500
        
        success, message = db_manager.delete_record(key)
        return jsonify({"success": success, "message": message})
    except Exception as e:
        print(f"删除记录API错误: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/config', methods=['GET'])
def get_config():
    """获取当前配置"""
    try:
        config = load_config()
        return jsonify({"success": True, "config": config})
    except Exception as e:
        print(f"获取配置失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/config', methods=['PUT'])
def update_config():
    """更新配置"""
    try:
        data = request.get_json()
        config = load_config()
        
        # 更新配置
        if 'db_path' in data:
            config['db_path'] = data['db_path']
        
        # 保存配置
        if save_config(config):
            # 重新初始化数据库管理器
            global db_manager
            try:
                db_manager = DatabaseManager(config.get('db_path'))
                print(f"数据库重新连接成功: {db_manager.db_path}")
                return jsonify({"success": True, "message": "配置已更新", "config": config})
            except Exception as e:
                return jsonify({"success": False, "error": f"配置已保存，但数据库连接失败: {str(e)}"}), 500
        else:
            return jsonify({"success": False, "error": "配置保存失败"}), 500
    except Exception as e:
        print(f"更新配置失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/browse', methods=['GET'])
def browse_files():
    """浏览文件系统"""
    try:
        # 获取目录路径参数
        directory = request.args.get('directory', os.path.expanduser('~'))
        
        # 确保路径存在
        if not os.path.exists(directory):
            return jsonify({"success": False, "error": f"目录不存在: {directory}"}), 404
        
        # 确保是目录
        if not os.path.isdir(directory):
            return jsonify({"success": False, "error": f"不是有效的目录: {directory}"}), 400
        
        # 获取父目录
        parent_dir = os.path.dirname(directory)
        
        # 获取目录内容
        items = []
        try:
            for item in os.listdir(directory):
                item_path = os.path.join(directory, item)
                item_type = "directory" if os.path.isdir(item_path) else "file"
                
                # 对于文件，只显示 .db 和 .sqlite 文件
                if item_type == "file" and not (item.endswith('.db') or item.endswith('.sqlite') or item.endswith('.vscdb')):
                    continue
                
                items.append({
                    "name": item,
                    "path": item_path,
                    "type": item_type
                })
                
            # 按类型和名称排序
            items.sort(key=lambda x: (0 if x["type"] == "directory" else 1, x["name"].lower()))
            
            return jsonify({
                "success": True, 
                "directory": directory,
                "parent": parent_dir,
                "items": items
            })
            
        except PermissionError:
            return jsonify({"success": False, "error": f"没有权限访问目录: {directory}"}), 403
            
    except Exception as e:
        print(f"浏览文件系统失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.errorhandler(403)
def forbidden(error):
    """处理403错误"""
    return jsonify({"error": "访问被拒绝，请检查权限"}), 403

@app.errorhandler(404)
def not_found(error):
    """处理404错误"""
    return jsonify({"error": "页面或资源未找到"}), 404

@app.errorhandler(500)
def internal_error(error):
    """处理500错误"""
    return jsonify({"error": "服务器内部错误"}), 500

if __name__ == '__main__':
    print("启动Flask应用...")
    print(f"访问地址: http://127.0.0.1:5001")
    app.run(debug=True, host='127.0.0.1', port=5001) 