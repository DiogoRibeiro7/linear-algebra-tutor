"""Claude LLM integration service."""
import anthropic
from typing import List, Dict, Optional
from app.config import get_settings
from app.core.prompts import TUTOR_SYSTEM_PROMPT

settings = get_settings()


class ClaudeService:
    """Service for interacting with Claude API."""
    
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = settings.CLAUDE_MODEL
        
    async def generate_response(
        self,
        user_message: str,
        conversation_history: List[Dict[str, str]] = None,
        context: Optional[str] = None,
        system_prompt: Optional[str] = None
    ) -> str:
        """
        Generate a response from Claude.
        
        Args:
            user_message: The user's current message
            conversation_history: Previous messages in the conversation
            context: Additional context from RAG system
            system_prompt: Override default system prompt
            
        Returns:
            Claude's response as a string
        """
        # Build messages list
        messages = []
        
        # Add conversation history
        if conversation_history:
            for msg in conversation_history[-settings.MAX_CONVERSATION_HISTORY:]:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        # Add current message with context if available
        current_message = user_message
        if context:
            current_message = f"""Context from course materials:
{context}

Student question: {user_message}"""
        
        messages.append({
            "role": "user",
            "content": current_message
        })
        
        # Use custom system prompt or default tutor prompt
        final_system_prompt = system_prompt or TUTOR_SYSTEM_PROMPT
        
        try:
            # Call Claude API
            response = self.client.messages.create(
                model=self.model,
                max_tokens=settings.MAX_TOKENS,
                temperature=settings.TEMPERATURE,
                system=final_system_prompt,
                messages=messages
            )
            
            # Extract text from response
            return response.content[0].text
            
        except Exception as e:
            print(f"Error calling Claude API: {e}")
            raise
    
    async def generate_hint(self, problem: str, context: str = "") -> str:
        """Generate a hint for a problem."""
        from app.core.prompts import HINT_GENERATION_PROMPT
        
        prompt = HINT_GENERATION_PROMPT.format(
            problem=problem,
            context=context
        )
        
        response = self.client.messages.create(
            model=self.model,
            max_tokens=500,
            temperature=0.7,
            system="You are a helpful Linear Algebra tutor providing hints.",
            messages=[{"role": "user", "content": prompt}]
        )
        
        return response.content[0].text
    
    async def check_solution(self, problem: str, solution: str) -> Dict[str, any]:
        """Check a student's solution."""
        from app.core.prompts import SOLUTION_CHECKER_PROMPT
        
        prompt = SOLUTION_CHECKER_PROMPT.format(
            problem=problem,
            solution=solution
        )
        
        response = self.client.messages.create(
            model=self.model,
            max_tokens=1000,
            temperature=0.3,  # Lower temperature for evaluation
            system="You are an expert Linear Algebra evaluator.",
            messages=[{"role": "user", "content": prompt}]
        )
        
        # Parse the response (in production, you might want structured output)
        feedback = response.content[0].text
        
        return {
            "feedback": feedback,
            "timestamp": None  # Add timestamp if needed
        }
    
    async def generate_visualization_code(self, concept: str, context: str = "") -> str:
        """Generate Python visualization code."""
        from app.core.prompts import VISUALIZATION_PROMPT
        
        prompt = VISUALIZATION_PROMPT.format(
            concept=concept,
            context=context
        )
        
        response = self.client.messages.create(
            model=self.model,
            max_tokens=1500,
            temperature=0.5,
            system="You are a Python expert specializing in mathematical visualizations.",
            messages=[{"role": "user", "content": prompt}]
        )
        
        return response.content[0].text


# Singleton instance
claude_service = ClaudeService()
