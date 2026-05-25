"""Main tutoring service combining LLM and RAG."""
import re
from typing import Any, Dict, List, Optional
from app.core.llm import claude_service
from app.core.rag import rag_system
from app.config import get_settings

settings = get_settings()

_FENCE_RE = re.compile(
    r"\A\s*```(?:python)?\s*\n(?P<body>.*?)\n```\s*\Z",
    re.DOTALL,
)


class TutorService:
    """Main service for AI tutoring functionality."""
    
    def __init__(self):
        self.claude = claude_service
        self.rag = rag_system
        
    async def answer_question(
        self,
        question: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        use_rag: bool = True
    ) -> Dict[str, Any]:
        """
        Answer a student's question.
        
        Args:
            question: Student's question
            conversation_history: Previous messages
            use_rag: Whether to retrieve course materials
            
        Returns:
            Response with answer and metadata
        """
        context = None
        retrieved_docs = []
        
        # Retrieve relevant course materials if enabled
        if use_rag and self.rag.embeddings is not None:
            retrieved_docs = self.rag.retrieve(question, top_k=3)
            
            # Format context from retrieved documents
            context_parts = []
            for i, doc in enumerate(retrieved_docs):
                context_parts.append(
                    f"[Source {i+1}: {doc['metadata']['source']}]\n{doc['content']}"
                )
            context = "\n\n".join(context_parts)
        
        # Generate response using Claude
        response = await self.claude.generate_response(
            user_message=question,
            conversation_history=conversation_history,
            context=context
        )
        
        return {
            "answer": response,
            "sources": [doc["metadata"] for doc in retrieved_docs],
            "context_used": context is not None
        }
    
    async def provide_hint(
        self,
        problem: str,
        student_context: str = ""
    ) -> str:
        """
        Provide a hint for a problem without giving the full solution.
        
        Args:
            problem: The problem description
            student_context: What the student has tried so far
            
        Returns:
            A helpful hint
        """
        return await self.claude.generate_hint(problem, student_context)
    
    async def evaluate_solution(
        self,
        problem: str,
        solution: str
    ) -> Dict[str, Any]:
        """
        Evaluate a student's solution.
        
        Args:
            problem: The problem description
            solution: Student's submitted solution
            
        Returns:
            Evaluation with feedback
        """
        return await self.claude.check_solution(problem, solution)
    
    async def generate_visualization(
        self,
        concept: str,
        specific_request: str = ""
    ) -> Dict[str, str]:
        """
        Generate visualization code for a concept.
        
        Args:
            concept: The Linear Algebra concept to visualize
            specific_request: Specific visualization request
            
        Returns:
            Dictionary with Python code and metadata
        """
        code = await self.claude.generate_visualization_code(
            concept,
            specific_request
        )

        # Strip an outer ```python ... ``` fence only; preserve any inner
        # fences that might legitimately appear in comments or strings.
        m = _FENCE_RE.match(code)
        if m:
            code = m.group("body")
        code = code.strip()
        
        return {
            "code": code,
            "language": "python",
            "concept": concept
        }
    
    async def get_personalized_recommendation(
        self,
        student_progress: Dict[str, float],
        weak_topics: List[str]
    ) -> Dict[str, Any]:
        """
        Get personalized problem recommendations based on student progress.
        
        Args:
            student_progress: Dictionary of topic -> mastery score
            weak_topics: List of topics where student is struggling
            
        Returns:
            Recommendations for next steps
        """
        # In a real implementation, this would query the problem bank
        # and use student progress to recommend appropriate problems
        
        recommendations = {
            "focus_topics": weak_topics[:3],  # Top 3 weak areas
            "recommended_problems": [],  # Would be populated from database
            "next_steps": []
        }
        
        # Generate personalized advice using Claude
        progress_summary = "\n".join([
            f"- {topic}: {score:.1%} mastery"
            for topic, score in student_progress.items()
        ])
        
        prompt = f"""Based on this student's progress in Linear Algebra:

{progress_summary}

Weak areas: {', '.join(weak_topics)}

Provide 3 specific, actionable recommendations for what they should study next.
Be encouraging and specific about which concepts to review.
"""
        
        advice = await self.claude.generate_response(
            user_message=prompt,
            system_prompt="You are an expert Linear Algebra tutor providing study guidance."
        )
        
        recommendations["personalized_advice"] = advice
        
        return recommendations


# Singleton instance
tutor_service = TutorService()
